package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

type Provider struct {
	ProviderID      string
	ActiveProofSets int
	DataSizeStored  int64
	NumRoots        int64
	FirstSeen       time.Time
	LastSeen        time.Time
}

type ProofSet struct {
	SetID           string    `db:"set_id"`
	Status          bool      `db:"status"`
	FirstRoot       string    `db:"first_root"`
	NumRoots        int64     `db:"total_roots"`
	CreatedAt       time.Time `db:"created_at_time"`
	UpdatedAt       time.Time `db:"updated_at_time"`
	TxHash          string    `db:"tx_hash"`
	ProofsSubmitted int       `db:"proofs_submitted"`
	Faults          int       `db:"faults"`
}

type Transaction struct {
	TxID   string
	Time   time.Time
	Method string
	Status string
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetProviders(ctx context.Context, offset, limit int) ([]Provider, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT owner) 
		FROM proof_sets 
		WHERE is_active = true
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get provider count: %w", err)
	}

	// Then get paginated providers with their stats
	query := `
		WITH provider_stats AS (
			SELECT 
				ps.owner as provider_id,
				COUNT(CASE WHEN ps.is_active = true THEN 1 END) as active_proof_sets,
				SUM(ps.total_data_size) as data_size_stored,
				COUNT(fr.id) as faults,
				MIN(ps.created_at) as first_seen,
				MAX(ps.updated_at) as last_seen
			FROM proof_sets ps
			LEFT JOIN fault_records fr ON ps.id = fr.set_id
			WHERE ps.is_active = true
			GROUP BY ps.owner
		)
		SELECT 
			provider_id,
			active_proof_sets,
			data_size_stored,
			faults,
			first_seen,
			last_seen
		FROM provider_stats
		ORDER BY active_proof_sets DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query providers: %w", err)
	}
	defer rows.Close()

	var providers []Provider
	for rows.Next() {
		var p Provider
		err := rows.Scan(
			&p.ProviderID,
			&p.ActiveProofSets,
			&p.DataSizeStored,
			&p.NumRoots,
			&p.FirstSeen,
			&p.LastSeen,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan provider: %w", err)
		}
		providers = append(providers, p)
	}

	return providers, total, nil
}

func (r *Repository) GetProviderDetails(ctx context.Context, providerID string) (*Provider, []ProofSet, error) {
	var provider Provider
	err := r.db.QueryRow(ctx, `
		WITH provider_stats AS (
			SELECT 
				COUNT(CASE WHEN ps.is_active = true THEN 1 END) as active_proof_sets,
				SUM(ps.total_data_size) as data_size_stored,
				MIN(ps.created_at) as first_seen,
				MAX(ps.updated_at) as last_seen
			FROM proof_sets ps
			WHERE ps.owner = $1
			AND ps.is_active = true
		),
		fault_count AS (
			SELECT COUNT(*) as faults
			FROM fault_records fr
			JOIN proof_sets ps ON fr.set_id = ps.id
			WHERE ps.owner = $1
		)
		SELECT 
			$1,
			ps.active_proof_sets,
			ps.data_size_stored,
			COALESCE(fc.faults, 0),
			ps.first_seen,
			ps.last_seen
		FROM provider_stats ps
		CROSS JOIN fault_count fc
	`, providerID).Scan(
		&provider.ProviderID,
		&provider.ActiveProofSets,
		&provider.DataSizeStored,
		&provider.NumRoots,
		&provider.FirstSeen,
		&provider.LastSeen,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get provider details: %w", err)
	}

	query := `
		SELECT 
			CAST(ps.id AS TEXT) as set_id,
			ps.is_active as status,
			'' as first_root,
			ps.total_roots as num_roots,
			ps.created_at as created_at_time,
			ps.updated_at as updated_at_time,
			'' as tx_hash,
			(SELECT COUNT(*) FROM proof_fees WHERE proof_fees.set_id = ps.id) as proofs_submitted,
			COUNT(fr.id) as faults
		FROM proof_sets ps
		LEFT JOIN proof_fees pf ON ps.set_id = pf.set_id
		LEFT JOIN fault_records fr ON ps.set_id = fr.set_id
		WHERE owner = $1
		AND is_active = true
		GROUP BY 
			ps.id,
			ps.is_active,
			ps.total_roots,
			ps.created_at,
			ps.updated_at
		ORDER BY ps.created_at DESC
	`

	rows, err := r.db.Query(ctx, query, providerID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query proof sets: %w", err)
	}
	defer rows.Close()

	var proofSets []ProofSet
	for rows.Next() {
		var ps ProofSet
		err := rows.Scan(
			&ps.SetID,
			&ps.Status,
			&ps.FirstRoot,
			&ps.NumRoots,
			&ps.CreatedAt,
			&ps.UpdatedAt,
			&ps.TxHash,
			&ps.ProofsSubmitted,
			&ps.Faults,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to scan proof set: %w", err)
		}
		proofSets = append(proofSets, ps)
	}

	return &provider, proofSets, nil
}

func (r *Repository) GetProofSets(ctx context.Context, sortBy, order string, offset, limit int) ([]ProofSet, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM proof_sets
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set count: %w", err)
	}

	orderByClause := "COUNT(pf.set_id)"
	switch sortBy {
	case "proofsSubmitted":
		orderByClause = "COUNT(pf.set_id)"
	case "size":
		orderByClause = "ps.total_roots"
	case "faults":
		orderByClause = "COUNT(fr.id)"
	}

	if order == "asc" {
		orderByClause += " ASC"
	} else {
		orderByClause += " DESC"
	}

	query := fmt.Sprintf(`
		SELECT 
			CAST(ps.set_id AS TEXT) as set_id,
			ps.is_active as status,
			'' as first_root,
			ps.total_roots as num_roots,
			ps.created_at as created_at_time,
			ps.updated_at as updated_at_time,
			'' as tx_hash,
			COUNT(DISTINCT pf.fee_id) as proofs_submitted,
			COUNT(DISTINCT fr.id) as faults
		FROM proof_sets ps
		LEFT JOIN proof_fees pf ON ps.set_id = pf.set_id
		LEFT JOIN fault_records fr ON ps.set_id = fr.set_id
		GROUP BY 
			ps.set_id,
			ps.is_active,
			ps.total_roots,
			ps.created_at,
			ps.updated_at
		ORDER BY %s
		LIMIT $1 OFFSET $2
	`, orderByClause)

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query proof sets: %w", err)
	}
	defer rows.Close()

	var proofSets []ProofSet
	for rows.Next() {
		var ps ProofSet
		err := rows.Scan(
			&ps.SetID,
			&ps.Status,
			&ps.FirstRoot,
			&ps.NumRoots,
			&ps.CreatedAt,
			&ps.UpdatedAt,
			&ps.TxHash,
			&ps.ProofsSubmitted,
			&ps.Faults,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan proof set: %w", err)
		}
		proofSets = append(proofSets, ps)
	}

	return proofSets, total, nil
}

func (r *Repository) GetProofSetDetails(ctx context.Context, proofSetID string, txFilter string) (*ProofSet, []Transaction, error) {
	var ps ProofSet
	err := r.db.QueryRow(ctx, `
		SELECT 
			CAST(ps.set_id AS TEXT) as set_id,
			ps.is_active as status,
			'' as first_root,
			ps.total_roots as num_roots,
			ps.created_at as created_at_time,
			ps.updated_at as updated_at_time,
			'' as tx_hash,
			COUNT(DISTINCT pf.fee_id) as proofs_submitted
		FROM proof_sets ps
		LEFT JOIN proof_fees pf ON ps.set_id = pf.set_id
		WHERE ps.set_id = $1
		GROUP BY 
			ps.set_id,
			ps.is_active,
			ps.total_roots,
			ps.created_at,
			ps.updated_at
	`, proofSetID).Scan(
		&ps.SetID,
		&ps.Status,
		&ps.FirstRoot,
		&ps.NumRoots,
		&ps.CreatedAt,
		&ps.UpdatedAt,
		&ps.TxHash,
		&ps.ProofsSubmitted,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get proof set details: %w", err)
	}

	query := `
		WITH all_events AS (
			SELECT 
				t.hash as tx_id,
				pf.created_at as time,
				'proof_fee' as method,
				'success' as status
			FROM proof_fees pf
			JOIN transactions t ON pf.fee_id = t.message_id
			WHERE pf.set_id = $1
			UNION ALL
			SELECT 
				el.transaction_hash as tx_id,
				fr.created_at as time,
				'fault_record',
				'failed'
			FROM fault_records fr
			JOIN event_logs el ON fr.set_id = el.set_id
			WHERE fr.set_id = $1
		)
		SELECT tx_id, time, method, status
		FROM all_events
	`
	if txFilter != "all" {
		query += fmt.Sprintf(" WHERE method = '%s'", txFilter)
	}
	query += " ORDER BY time DESC"

	rows, err := r.db.Query(ctx, query, proofSetID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(&tx.TxID, &tx.Time, &tx.Method, &tx.Status)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to scan transaction: %w", err)
		}
		transactions = append(transactions, tx)
	}

	return &ps, transactions, nil
}

func (r *Repository) GetProofSetHeatmap(ctx context.Context, proofSetID string) ([]struct {
	Date   time.Time
	Status string
	SetID  string
}, error) {
	query := `
		WITH RECURSIVE dates AS (
			SELECT current_date - interval '6 days' as date
			UNION ALL
			SELECT date + interval '1 day'
			FROM dates
			WHERE date < current_date
		),
		daily_proofs AS (
			SELECT 
				date_trunc('day', created_at) as proof_date,
				'success' as status,
				set_id::text as set_id
			FROM proof_fees
			WHERE set_id = $1::bigint
			AND created_at >= current_date - interval '7 days'
			UNION ALL
			SELECT 
				date_trunc('day', created_at),
				'failed',
				set_id::text as set_id
			FROM fault_records
			WHERE set_id = $1::bigint
			AND created_at >= current_date - interval '7 days'
		)
		SELECT 
			d.date,
			COALESCE(dp.status, 'idle') as status,
			COALESCE(dp.set_id, '') as set_id
		FROM dates d
		LEFT JOIN daily_proofs dp ON date_trunc('day', dp.proof_date) = d.date
		ORDER BY d.date
	`

	rows, err := r.db.Query(ctx, query, proofSetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query heatmap data: %w", err)
	}
	defer rows.Close()

	var heatmap []struct {
		Date   time.Time
		Status string
		SetID  string
	}

	for rows.Next() {
		var entry struct {
			Date   time.Time
			Status string
			SetID  string
		}
		err := rows.Scan(&entry.Date, &entry.Status, &entry.SetID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan heatmap entry: %w", err)
		}
		heatmap = append(heatmap, entry)
	}

	return heatmap, nil
}

func (r *Repository) GetNetworkMetrics(ctx context.Context) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	var totalProofSets int
	// Total active proof sets
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM proof_sets WHERE is_active = true
	`).Scan(&totalProofSets)
	if err != nil {
		return nil, fmt.Errorf("failed to get total proof sets: %w", err)
	}
	metrics["totalProofSets"] = totalProofSets

	var totalProviders int
	// Total providers
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT owner) FROM proof_sets WHERE is_active = true
	`).Scan(&totalProviders)
	if err != nil {
		return nil, fmt.Errorf("failed to get total providers: %w", err)
	}
	metrics["totalProviders"] = totalProviders

	var totalDataSize int64
	// Total data size stored
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_data_size), 0) 
		FROM proof_sets WHERE is_active = true
	`).Scan(&totalDataSize)
	if err != nil {
		return nil, fmt.Errorf("failed to get total data size: %w", err)
	}
	metrics["totalDataSize"] = totalDataSize

	var totalPieces int
	// Total data pieces
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_roots), 0) 
		FROM proof_sets WHERE is_active = true
	`).Scan(&totalPieces)
	if err != nil {
		return nil, fmt.Errorf("failed to get total pieces: %w", err)
	}
	metrics["totalPieces"] = totalPieces

	var totalProofs int
	// Total proofs submitted
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM proof_fees
	`).Scan(&totalProofs)
	if err != nil {
		return nil, fmt.Errorf("failed to get total proofs: %w", err)
	}
	metrics["totalProofs"] = totalProofs
	// Total faults
	var totalFaults int
	err = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM fault_records`).Scan(&totalFaults)
	if err != nil {
		return nil, fmt.Errorf("failed to get total faults: %w", err)
	}
	metrics["totalFaults"] = totalFaults

	// Unique data metrics (assuming root_piece_id tracks unique pieces)
	var uniqueDataSize int64
	var uniquePieces int
	err = r.db.QueryRow(ctx, `
		SELECT 
			COALESCE(SUM(DISTINCT total_data_size), 0),
			COUNT(DISTINCT set_id)
		FROM proof_sets
	`).Scan(&uniqueDataSize, &uniquePieces)
	if err != nil {
		return nil, fmt.Errorf("failed to get unique metrics: %w", err)
	}
	metrics["uniqueDataSize"] = uniqueDataSize
	metrics["uniquePieces"] = uniquePieces

	return metrics, nil
}

func (r *Repository) Search(ctx context.Context, query string, limit int) ([]map[string]interface{}, error) {
	searchQuery := `
		(SELECT 
			'provider' as type,
			owner as id,
			NULL as proof_set_id,
			COUNT(DISTINCT set_id) as active_sets,
			SUM(total_data_size) as data_size
		FROM proof_sets
		WHERE owner ILIKE $1
		GROUP BY owner
		LIMIT $2)
		
		UNION ALL
		
		(SELECT 
			'proofset' as type,
			NULL as id,
			set_id as proof_set_id,
			COUNT(DISTINCT set_id) as active_sets,
			total_data_size as data_size
		FROM proof_sets
		WHERE set_id ILIKE $1
		LIMIT $2)
	`

	rows, err := r.db.Query(ctx, searchQuery, "%"+query+"%", limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var resultType, id, proofSetID string
		var activeSets *int
		var dataSize *int64

		err := rows.Scan(
			&resultType,
			&id,
			&proofSetID,
			&activeSets,
			&dataSize,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan search result: %w", err)
		}

		result := map[string]interface{}{
			"type":       resultType,
			"id":         id,
			"proofSetId": proofSetID,
			"activeSets": activeSets,
			"dataSize":   dataSize,
		}
		results = append(results, result)
	}

	return results, nil
}
