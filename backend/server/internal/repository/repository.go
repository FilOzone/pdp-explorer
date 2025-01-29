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
	Status          string    `db:"status"`
	FirstRoot       string    `db:"first_root"`
	NumRoots        int64     `db:"num_roots"`
	CreatedAt       time.Time `db:"created_at_time"`
	UpdatedAt       time.Time `db:"updated_at_time"`
	TxHash          string    `db:"tx_hash"`
	ProofsSubmitted int       `db:"proofs_submitted"`
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
	// First get total count
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT provider_id) 
		FROM proof_sets 
		WHERE status != 'deleted'
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get provider count: %w", err)
	}

	// Then get paginated providers with their stats
	query := `
		WITH provider_stats AS (
			SELECT 
				ps.provider_id,
				COUNT(CASE WHEN ps.status = 'active' THEN 1 END) as active_proof_sets,
				SUM(COALESCE(ps.size, 0)) as data_size_stored,
				COUNT(fr.id) as faults,
				MIN(ps.created_at_time) as first_seen,
				MAX(ps.updated_at_time) as last_seen
			FROM proof_sets ps
			LEFT JOIN fault_records fr ON ps.set_id = fr.proof_set_id
			GROUP BY ps.provider_id
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
				COUNT(CASE WHEN status = 'active' THEN 1 END) as active_proof_sets,
				COUNT(*) as all_proof_sets,
				SUM(COALESCE(size, 0)) as data_size_stored,
				MIN(created_at_time) as first_seen,
				MAX(updated_at_time) as last_seen
			FROM proof_sets
			WHERE provider_id = $1
		),
		fault_count AS (
			SELECT COUNT(*) as faults
			FROM fault_records fr
			JOIN proof_sets ps ON fr.proof_set_id = ps.set_id
			WHERE ps.provider_id = $1
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
			set_id,
			status,
			first_root,
			num_roots,
			created_at_time,
			updated_at_time,
			tx_hash,
			(SELECT COUNT(*) FROM proof_fees WHERE proof_fees.set_id = ps.set_id) as proofs_submitted
		FROM proof_sets ps
		WHERE provider_id = $1
		ORDER BY created_at_time DESC
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
		SELECT GREATEST(
			COALESCE((SELECT MAX(set_id::integer) FROM proof_sets WHERE is_latest = true), 0),
			COALESCE((SELECT MAX(block_number) FROM proof_sets), 0)
		)
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set count: %w", err)
	}

	orderByClause := "proofs_submitted"
	switch sortBy {
	case "size":
		orderByClause = "size"
	case "faults":
		orderByClause = "faults"
	}
	if order == "asc" {
		orderByClause += " ASC"
	} else {
		orderByClause += " DESC"
	}

	query := fmt.Sprintf(`
		SELECT 
			ps.set_id,
			ps.status,
			ps.first_root,
			ps.num_roots,
			ps.created_at_time,
			ps.updated_at_time,
			ps.tx_hash,
			COUNT(pf.id) as proofs_submitted,
			COUNT(fr.id) as faults
		FROM proof_sets ps
		LEFT JOIN proof_fees pf ON ps.set_id = pf.set_id
		LEFT JOIN fault_records fr ON ps.set_id = fr.proof_set_id
		GROUP BY ps.set_id
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
			ps.set_id,
			ps.status,
			ps.first_root,
			ps.num_roots,
			ps.created_at_time,
			ps.updated_at_time,
			ps.tx_hash,
			COUNT(pf.id) as proofs_submitted
		FROM proof_sets ps
		LEFT JOIN proof_fees pf ON ps.set_id = pf.set_id
		WHERE ps.set_id = $1
		GROUP BY ps.set_id
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
				tx_hash as tx_id,
				created_at_time as time,
				'proof_fee' as method,
				'success' as status
			FROM proof_fees
			WHERE set_id = $1
			UNION ALL
			SELECT 
				tx_hash,
				created_at_time,
				'fault_record',
				'failed'
			FROM fault_records
			WHERE proof_set_id = $1
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
	Date        time.Time
	Status      string
	RootPieceID string
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
				date_trunc('day', created_at_time) as proof_date,
				'success' as status,
				set_id as root_piece_id
			FROM proof_fees
			WHERE set_id = $1
			AND created_at_time >= current_date - interval '7 days'
			UNION ALL
			SELECT 
				date_trunc('day', created_at_time),
				'failed',
				proof_set_id
			FROM fault_records
			WHERE proof_set_id = $1
			AND created_at_time >= current_date - interval '7 days'
		)
		SELECT 
			d.date,
			COALESCE(dp.status, 'idle') as status,
			COALESCE(dp.root_piece_id, '') as root_piece_id
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
		Date        time.Time
		Status      string
		RootPieceID string
	}

	for rows.Next() {
		var entry struct {
			Date        time.Time
			Status      string
			RootPieceID string
		}
		err := rows.Scan(&entry.Date, &entry.Status, &entry.RootPieceID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan heatmap entry: %w", err)
		}
		heatmap = append(heatmap, entry)
	}

	return heatmap, nil
}
