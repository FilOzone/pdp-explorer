package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

type Provider struct {
	ProviderID          string    `db:"address"`
	TotalFaultedPeriods int64     `db:"total_faulted_periods"`
	TotalDataSize       string    `db:"total_data_size"`
	ProofSetIDs         []int64   `db:"proof_set_ids"`
	BlockNumber         int64     `db:"block_number"`
	BlockHash           string    `db:"block_hash"`
	CreatedAt           time.Time `db:"created_at"`
	UpdatedAt           time.Time `db:"updated_at"`
	ActiveProofSets     int       // Computed field
	NumRoots            int64     // Computed field
	FirstSeen           time.Time // Computed field
	LastSeen            time.Time // Computed field
}

type ProofSet struct {
	SetID               int64     `db:"set_id"`
	Owner               string    `db:"owner"`
	ListenerAddr        string    `db:"listener_addr"`
	TotalFaultedPeriods int64     `db:"total_faulted_periods"`
	TotalDataSize       string    `db:"total_data_size"`
	TotalRoots          int64     `db:"total_roots"`
	TotalProvedRoots    int64     `db:"total_proved_roots"`
	TotalFeePaid        string    `db:"total_fee_paid"`
	LastProvenEpoch     int64     `db:"last_proven_epoch"`
	NextChallengeEpoch  int64     `db:"next_challenge_epoch"`
	IsActive            bool      `db:"is_active"`
	BlockNumber         int64     `db:"block_number"`
	BlockHash           string    `db:"block_hash"`
	CreatedAt           time.Time `db:"created_at"`
	UpdatedAt           time.Time `db:"updated_at"`
}

type Transaction struct {
	Hash        string    `db:"hash"`
	ProofSetID  int64     `db:"proof_set_id"`
	MessageID   string    `db:"message_id"`
	Height      int64     `db:"height"`
	FromAddress string    `db:"from_address"`
	ToAddress   string    `db:"to_address"`
	Value       string    `db:"value"`
	Method      string    `db:"method"`
	Status      bool      `db:"status"`
	BlockNumber int64     `db:"block_number"`
	BlockHash   string    `db:"block_hash"`
	CreatedAt   time.Time `db:"created_at"`
}

type Activity struct {
	ID        string    `db:"id"`
	Type      string    `db:"type"`
	Timestamp time.Time `db:"timestamp"`
	Details   string    `db:"details"`
	Value     int       `db:"value"`
}

type EventLog struct {
	SetID           int64           `db:"set_id"`
	Address         string          `db:"address"`
	Name            string          `db:"name"`
	Data            json.RawMessage `db:"data"`
	LogIndex        int64           `db:"log_index"`
	Removed         bool            `db:"removed"`
	Topics          []string        `db:"topics"`
	BlockNumber     int64           `db:"block_number"`
	BlockHash       string          `db:"block_hash"`
	TransactionHash string          `db:"transaction_hash"`
	CreatedAt       time.Time       `db:"created_at"`
}

type Root struct {
	SetId            int64     `db:"set_id"`
	RootId           int64     `db:"root_id"`
	RawSize          int64    `db:"raw_size"`
	Cid              string    `db:"cid"`
	Removed          bool      `db:"removed"`
	TotalPeriodsFaulted      int64    `db:"total_periods_faulted"`
	TotalProofsSubmitted      int64    `db:"total_proofs_submitted"`
	LastProvenEpoch  int64    `db:"last_proven_epoch"`
	LastProvenAt     *time.Time `db:"last_proven_at"`
	LastFaultedEpoch int64    `db:"last_faulted_epoch"`
	LastFaultedAt    *time.Time `db:"last_faulted_at"`
	CreatedAt        time.Time `db:"created_at"`
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetProviders(ctx context.Context, offset, limit int) ([]Provider, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT address) 
		FROM providers
		WHERE array_length(proof_set_ids, 1) > 0
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get provider count: %w", err)
	}

	query := `
		WITH latest_providers AS (
			SELECT p.*
			FROM providers p
			INNER JOIN (
				SELECT address, MAX(block_number) as max_block_number
				FROM providers
				GROUP BY address
			) latest ON p.address = latest.address AND p.block_number = latest.max_block_number
		),
		latest_proof_sets AS (
			SELECT ps.*
			FROM proof_sets ps
			INNER JOIN (
				SELECT set_id, MAX(block_number) as max_block_number
				FROM proof_sets
				WHERE is_active = true
				GROUP BY set_id
			) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
		),
		provider_stats AS (
			SELECT 
				p.address,
				p.total_faulted_periods,
				p.total_data_size,
				ARRAY_AGG(DISTINCT ps.set_id) FILTER (WHERE ps.set_id IS NOT NULL) as proof_set_ids,
				p.block_number,
				p.block_hash,
				p.created_at,
				p.updated_at,
				COUNT(CASE WHEN ps.is_active = true THEN 1 END) as active_proof_sets,
				COALESCE(SUM(ps.total_roots), 0) as total_roots,
				MIN(ps.created_at) as first_seen,
				MAX(ps.updated_at) as last_seen
			FROM latest_providers p
			LEFT JOIN latest_proof_sets ps ON ps.owner = p.address
			GROUP BY p.address, p.total_faulted_periods, p.total_data_size,
					 p.block_number, p.block_hash, p.created_at, p.updated_at
			HAVING COUNT(ps.set_id) > 0
		)
		SELECT 
			address,
			total_faulted_periods,
			COALESCE(total_data_size, '0') as total_data_size,
			proof_set_ids,
			block_number,
			block_hash,
			created_at,
			updated_at,
			COALESCE(active_proof_sets, 0) as active_proof_sets,
			total_roots,
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
			&p.TotalFaultedPeriods,
			&p.TotalDataSize,
			&p.ProofSetIDs,
			&p.BlockNumber,
			&p.BlockHash,
			&p.CreatedAt,
			&p.UpdatedAt,
			&p.ActiveProofSets,
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
		WITH latest_provider AS (
			SELECT p.*
			FROM providers p
			INNER JOIN (
				SELECT address, MAX(block_number) as max_block_number
				FROM providers
				WHERE address = $1
				GROUP BY address
			) latest ON p.address = latest.address AND p.block_number = latest.max_block_number
		),
		latest_proof_sets AS (
			SELECT ps.*
			FROM proof_sets ps
			INNER JOIN (
				SELECT set_id, MAX(block_number) as max_block_number
				FROM proof_sets
				WHERE is_active = true
				GROUP BY set_id
			) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
		),
		provider_stats AS (
			SELECT 
				p.address,
				p.total_faulted_periods,
				p.total_data_size,
				p.proof_set_ids,
				p.block_number,
				p.block_hash,
				p.created_at,
				p.updated_at,
				COUNT(CASE WHEN ps.is_active = true THEN 1 END) as active_proof_sets,
				SUM(ps.total_roots) as total_roots,
				MIN(ps.created_at) as first_seen,
				MAX(ps.updated_at) as last_seen
			FROM latest_provider p
			LEFT JOIN latest_proof_sets ps ON ps.owner = p.address
			GROUP BY p.address, p.total_faulted_periods, p.total_data_size, p.proof_set_ids,
					 p.block_number, p.block_hash, p.created_at, p.updated_at
		)
		SELECT 
			address,
			total_faulted_periods,
			total_data_size,
			proof_set_ids,
			block_number,
			block_hash,
			created_at,
			updated_at,
			active_proof_sets,
			total_roots,
			first_seen,
			last_seen
		FROM provider_stats
	`, providerID).Scan(
		&provider.ProviderID,
		&provider.TotalFaultedPeriods,
		&provider.TotalDataSize,
		&provider.ProofSetIDs,
		&provider.BlockNumber,
		&provider.BlockHash,
		&provider.CreatedAt,
		&provider.UpdatedAt,
		&provider.ActiveProofSets,
		&provider.NumRoots,
		&provider.FirstSeen,
		&provider.LastSeen,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get provider details: %w", err)
	}

	query := `
		WITH latest_proof_sets AS (
			SELECT ps.*
			FROM proof_sets ps
			INNER JOIN (
				SELECT set_id, MAX(block_number) as max_block_number
				FROM proof_sets
				WHERE owner = $1 AND is_active = true
				GROUP BY set_id
			) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
		)
		SELECT 
			ps.set_id,
			ps.owner,
			ps.listener_addr,
			ps.total_faulted_periods,
			ps.total_data_size,
			ps.total_roots,
			ps.total_proved_roots,
			ps.total_fee_paid,
			ps.last_proven_epoch,
			ps.next_challenge_epoch,
			ps.is_active,
			ps.block_number,
			ps.block_hash,
			ps.created_at,
			ps.updated_at
		FROM latest_proof_sets ps
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
			&ps.Owner,
			&ps.ListenerAddr,
			&ps.TotalFaultedPeriods,
			&ps.TotalDataSize,
			&ps.TotalRoots,
			&ps.TotalProvedRoots,
			&ps.TotalFeePaid,
			&ps.LastProvenEpoch,
			&ps.NextChallengeEpoch,
			&ps.IsActive,
			&ps.BlockNumber,
			&ps.BlockHash,
			&ps.CreatedAt,
			&ps.UpdatedAt,
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
		SELECT COUNT(DISTINCT set_id) FROM proof_sets WHERE is_active = true
	`).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set count: %w", err)
	}

	orderByClause := "total_proved_roots"
	switch sortBy {
	case "proofsSubmitted":
		orderByClause = "total_proved_roots"
	case "size":
		orderByClause = "COALESCE(ps.total_roots, 0)"
	case "faults":
		orderByClause = "total_faulted_periods"
	}

	if order == "asc" {
		orderByClause += " ASC"
	} else {
		orderByClause += " DESC"
	}

	query := fmt.Sprintf(`
		WITH latest_proof_sets AS (
			SELECT ps.*
			FROM proof_sets ps
			INNER JOIN (
				SELECT set_id, MAX(block_number) as max_block_number
				FROM proof_sets
				WHERE is_active = true
				GROUP BY set_id
			) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
		),
		last_proof AS (
			SELECT 
				set_id,
				MAX(created_at) as last_proof_time
			FROM proof_fees
			GROUP BY set_id
		)
		SELECT 
			ps.set_id,
			ps.owner,
			ps.listener_addr,
			ps.total_faulted_periods,
			COALESCE(ps.total_data_size, '0') as total_data_size,
			COALESCE(ps.total_roots, 0) as total_roots,
			COALESCE(ps.total_proved_roots, 0) as total_proved_roots,
			COALESCE(ps.total_fee_paid, '0') as total_fee_paid,
			ps.last_proven_epoch,
			ps.next_challenge_epoch,
			ps.is_active,
			ps.block_number,
			ps.block_hash,
			ps.created_at,
			COALESCE(lp.last_proof_time, ps.created_at) as updated_at
		FROM latest_proof_sets ps
		LEFT JOIN last_proof lp ON ps.set_id = lp.set_id
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
			&ps.Owner,
			&ps.ListenerAddr,
			&ps.TotalFaultedPeriods,
			&ps.TotalDataSize,
			&ps.TotalRoots,
			&ps.TotalProvedRoots,
			&ps.TotalFeePaid,
			&ps.LastProvenEpoch,
			&ps.NextChallengeEpoch,
			&ps.IsActive,
			&ps.BlockNumber,
			&ps.BlockHash,
			&ps.CreatedAt,
			&ps.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan proof set: %w", err)
		}
		proofSets = append(proofSets, ps)
	}

	return proofSets, total, nil
}

func (r *Repository) GetProofSetDetails(ctx context.Context, proofSetID string) (*ProofSet, error) {
	var ps ProofSet
	err := r.db.QueryRow(ctx, `
		WITH latest_block AS (
			SELECT MAX(block_number) as max_block_number
			FROM proof_sets
			WHERE set_id = $1
		)
		SELECT 
			ps.set_id,
			ps.owner,
			ps.listener_addr,
			ps.total_faulted_periods,
			ps.total_data_size,
			ps.total_roots,
			ps.total_proved_roots,
			ps.total_fee_paid,
			ps.last_proven_epoch,
			ps.next_challenge_epoch,
			ps.is_active,
			ps.block_number,
			ps.block_hash,
			ps.created_at,
			ps.updated_at
		FROM proof_sets ps
		JOIN latest_block lb ON ps.block_number = lb.max_block_number
		WHERE ps.set_id = $1
	`, proofSetID).Scan(
		&ps.SetID,
		&ps.Owner,
		&ps.ListenerAddr,
		&ps.TotalFaultedPeriods,
		&ps.TotalDataSize,
		&ps.TotalRoots,
		&ps.TotalProvedRoots,
		&ps.TotalFeePaid,
		&ps.LastProvenEpoch,
		&ps.NextChallengeEpoch,
		&ps.IsActive,
		&ps.BlockNumber,
		&ps.BlockHash,
		&ps.CreatedAt,
		&ps.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get proof set details: %w", err)
	}

	return &ps, nil
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
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT set_id) FROM proof_sets WHERE is_active = true
	`).Scan(&totalProofSets)
	if err != nil {
		return nil, fmt.Errorf("failed to get total proof sets: %w", err)
	}
	metrics["totalProofSets"] = totalProofSets

	var totalProviders int
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT address) FROM providers
	`).Scan(&totalProviders)
	if err != nil {
		return nil, fmt.Errorf("failed to get total providers: %w", err)
	}
	metrics["totalProviders"] = totalProviders

	var totalDataSize string
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_data_size::numeric), '0')
		FROM (
			SELECT DISTINCT ON (address) total_data_size
			FROM providers
			ORDER BY address, block_number DESC
		) unique_providers
	`).Scan(&totalDataSize)
	if err != nil {
		return nil, fmt.Errorf("failed to get total data size: %w", err)
	}
	metrics["totalDataSize"] = totalDataSize

	var totalPieces int
	// Total data pieces
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_roots), 0)
		FROM (
			SELECT DISTINCT ON (set_id) total_roots
			FROM proof_sets
			WHERE is_active = true
			ORDER BY set_id, block_number DESC
		) unique_proof_sets
	`).Scan(&totalPieces)
	if err != nil {
		return nil, fmt.Errorf("failed to get total pieces: %w", err)
	}
	metrics["totalPieces"] = totalPieces

	var totalProofs int
	// Total proofs submitted - sum of total_proved_roots from the latest proof_set records
	err = r.db.QueryRow(ctx, `
		WITH latest_proof_sets AS (
			SELECT DISTINCT ON (set_id) set_id, total_proved_roots
			FROM proof_sets
			WHERE is_active = true
			ORDER BY set_id, block_number DESC
		)
		SELECT COALESCE(SUM(total_proved_roots), 0) FROM latest_proof_sets
	`).Scan(&totalProofs)
	if err != nil {
		return nil, fmt.Errorf("failed to get total proofs: %w", err)
	}
	metrics["totalProofs"] = totalProofs
	// Total faults - sum of array_length of root_ids from all fault_records
	var totalFaults int
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(ARRAY_LENGTH(root_ids, 1)), 0) 
		FROM fault_records
	`).Scan(&totalFaults)
	if err != nil {
		return nil, fmt.Errorf("failed to get total faults: %w", err)
	}
	metrics["totalFaults"] = totalFaults

	// Unique data metrics based on unique root CIDs
	var uniqueDataSize string
	var uniquePieces int
	err = r.db.QueryRow(ctx, `
		SELECT 
			COALESCE(SUM(raw_size::numeric), '0'),
			COUNT(*)
		FROM (
			SELECT DISTINCT ON (cid) cid, raw_size
			FROM roots
			WHERE cid IS NOT NULL
		) unique_roots
	`).Scan(&uniqueDataSize, &uniquePieces)
	if err != nil {
		return nil, fmt.Errorf("failed to get unique metrics: %w", err)
	}
	metrics["uniqueDataSize"] = uniqueDataSize
	metrics["uniquePieces"] = uniquePieces

	return metrics, nil
}

func (r *Repository) Search(ctx context.Context, query string) ([]map[string]interface{}, error) {
	// Try to find provider
	providerQuery := `
		SELECT 
			'provider' as type,
			address as id,
			COUNT(DISTINCT ps.set_id) as active_sets,
			COALESCE(SUM(ps.total_data_size::numeric), '0') as data_size
		FROM providers p
		LEFT JOIN proof_sets ps ON ps.owner = p.address AND ps.is_active = true
		WHERE p.address ILIKE $1
		GROUP BY p.address
	`

	// Try to find proof set
	proofSetQuery := `
		SELECT 
			'proofset' as type,
			set_id::text as id,
			owner as provider_id,
			total_data_size as data_size
		FROM (
			SELECT DISTINCT ON (set_id) set_id, owner, total_data_size
			FROM proof_sets
			WHERE is_active = true
			ORDER BY set_id, block_number DESC
		) latest_proof_sets
		WHERE set_id::text ILIKE $1
	`

	var results []map[string]interface{}

	// Search for providers
	providerRows, err := r.db.Query(ctx, providerQuery, query+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to search providers: %w", err)
	}
	defer providerRows.Close()

	for providerRows.Next() {
		var resultType, id string
		var activeSets int
		var dataSize string

		err := providerRows.Scan(&resultType, &id, &activeSets, &dataSize)
		if err != nil {
			return nil, err
		}

		results = append(results, map[string]interface{}{
			"type":        resultType,
			"id":          id,
			"active_sets": activeSets,
			"data_size":   dataSize,
		})
	}

	// Search for proof sets
	proofSetRows, err := r.db.Query(ctx, proofSetQuery, query+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to search proof sets: %w", err)
	}
	defer proofSetRows.Close()

	for proofSetRows.Next() {
		var resultType, id, providerID, dataSize string

		err := proofSetRows.Scan(&resultType, &id, &providerID, &dataSize)
		if err != nil {
			return nil, err
		}

		results = append(results, map[string]interface{}{
			"type":        resultType,
			"id":          id,
			"provider_id": providerID,
			"data_size":   dataSize,
		})
	}

	return results, nil
}

func (r *Repository) GetProviderProofSets(ctx context.Context, providerID string, offset, limit int) ([]ProofSet, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT set_id) 
		FROM proof_sets 
		WHERE owner = $1 AND is_active = true
	`, providerID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get proof set count: %w", err)
	}

	query := `
		WITH latest_proof_sets AS (
			SELECT ps.*
			FROM proof_sets ps
			INNER JOIN (
				SELECT set_id, MAX(block_number) as max_block_number
				FROM proof_sets
				WHERE owner = $1 AND is_active = true
				GROUP BY set_id
			) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
		)
		SELECT 
			ps.set_id,
			ps.owner,
			ps.listener_addr,
			ps.total_faulted_periods,
			ps.total_data_size,
			ps.total_roots,
			ps.total_proved_roots,
			ps.total_fee_paid,
			ps.last_proven_epoch,
			ps.next_challenge_epoch,
			ps.is_active,
			ps.block_number,
			ps.block_hash,
			ps.created_at,
			ps.updated_at
		FROM latest_proof_sets ps
		ORDER BY ps.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, providerID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query proof sets: %w", err)
	}
	defer rows.Close()

	var proofSets []ProofSet
	for rows.Next() {
		var ps ProofSet
		err := rows.Scan(
			&ps.SetID,
			&ps.Owner,
			&ps.ListenerAddr,
			&ps.TotalFaultedPeriods,
			&ps.TotalDataSize,
			&ps.TotalRoots,
			&ps.TotalProvedRoots,
			&ps.TotalFeePaid,
			&ps.LastProvenEpoch,
			&ps.NextChallengeEpoch,
			&ps.IsActive,
			&ps.BlockNumber,
			&ps.BlockHash,
			&ps.CreatedAt,
			&ps.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan proof set: %w", err)
		}
		proofSets = append(proofSets, ps)
	}

	return proofSets, total, nil
}

func (r *Repository) GetProviderActivities(ctx context.Context, providerID string, activityType string) ([]Activity, error) {
	var query string
	if activityType == "prove_possession" || activityType == "all" {
		query = `
			WITH latest_proof_sets AS (
				SELECT ps.*
				FROM proof_sets ps
				INNER JOIN (
					SELECT set_id, MAX(block_number) as max_block_number
					FROM proof_sets
					WHERE owner = $1
					GROUP BY set_id
				) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
			),
			monthly_stats AS (
				SELECT 
					date_trunc('month', t.created_at) as month,
					COUNT(*) as count
				FROM transactions t
				JOIN latest_proof_sets ps ON t.proof_set_id = ps.set_id
				WHERE t.method = 'provePossession'
				GROUP BY date_trunc('month', t.created_at)
				ORDER BY month DESC
				LIMIT 6
			)
			SELECT 
				month::text as id,
				'prove_possession' as type,
				month as timestamp,
				count::text as details,
				count as value
			FROM monthly_stats
			ORDER BY month ASC
		`
	} else if activityType == "fault_recorded" {
		query = `
			WITH latest_proof_sets AS (
				SELECT ps.*
				FROM proof_sets ps
				INNER JOIN (
					SELECT set_id, MAX(block_number) as max_block_number
					FROM proof_sets
					GROUP BY set_id
				) latest ON ps.set_id = latest.set_id AND ps.block_number = latest.max_block_number
			),
			monthly_stats AS (
				SELECT 
					date_trunc('month', fr.created_at) as month,
					COUNT(*) as count
				FROM fault_records fr
				JOIN latest_proof_sets ps ON fr.set_id = ps.set_id
				WHERE ps.owner = $1
				GROUP BY date_trunc('month', fr.created_at)
				ORDER BY month DESC
				LIMIT 6
			)
			SELECT 
				month::text as id,
				'fault_recorded' as type,
				month as timestamp,
				count::text as details,
				count as value
			FROM monthly_stats
			ORDER BY month ASC
		`
	}

	rows, err := r.db.Query(ctx, query, providerID)
	if err != nil {
		return nil, fmt.Errorf("failed to query activities: %w", err)
	}
	defer rows.Close()

	var activities []Activity
	for rows.Next() {
		var a Activity
		err := rows.Scan(
			&a.ID,
			&a.Type,
			&a.Timestamp,
			&a.Details,
			&a.Value,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan activity: %w", err)
		}
		activities = append(activities, a)
	}

	return activities, nil
}

// GetProofSetEventLogs retrieves event logs for a specific proof set with pagination
func (r *Repository) GetProofSetEventLogs(ctx context.Context, proofSetID string, filter string, offset, limit int) ([]EventLog, int, error) {
	// Get total count of event logs
	var total int
	totalFilterQuery := `
		SELECT COUNT(*) 
		FROM event_logs 
		WHERE set_id = $1
	`

	if filter != "all" {
		totalFilterQuery += fmt.Sprintf(" AND name = '%s'", filter)
	}
	err := r.db.QueryRow(ctx, totalFilterQuery, proofSetID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get event log count: %w", err)
	}

	query := `
		SELECT 
			set_id,
			address,
			name,
			data,
			log_index,
			removed,
			topics,
			block_number,
			block_hash,
			transaction_hash,
			created_at
		FROM event_logs
		WHERE set_id = $1
	`
	if filter != "all" {
		query += fmt.Sprintf(" AND name = '%s'", filter)
	}

	query += `
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`;

	rows, err := r.db.Query(ctx, query, proofSetID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query event logs: %w", err)
	}
	defer rows.Close()

	var eventLogs []EventLog
	for rows.Next() {
		var log EventLog
		err := rows.Scan(
			&log.SetID,
			&log.Address,
			&log.Name,
			&log.Data,
			&log.LogIndex,
			&log.Removed,
			&log.Topics,
			&log.BlockNumber,
			&log.BlockHash,
			&log.TransactionHash,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan event log: %w", err)
		}
		eventLogs = append(eventLogs, log)
	}

	return eventLogs, total, nil
}

// GetProofSetTxs retrieves event logs for a specific proof set with pagination
func (r *Repository) GetProofSetTxs(ctx context.Context, proofSetID string, filter string, offset, limit int) ([]Transaction, int, error) {
	// Get total count of event logs
	var total int
	totalFilterQuery := `
		SELECT COUNT(*) 
		FROM transactions 
		WHERE proof_set_id = $1
	`

	if filter != "all" {
		totalFilterQuery += fmt.Sprintf(" AND method = '%s'", filter)
	}
	err := r.db.QueryRow(ctx, totalFilterQuery, proofSetID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get transactions count: %w", err)
	}

	query := `
		SELECT 
			proof_set_id,
			hash,
			message_id,
			height,
			from_address,
			to_address,
			value,
			method,
			status,
			block_number,
			block_hash,
			created_at
		FROM transactions
		WHERE proof_set_id = $1
	`
	if filter != "all" {
		query += fmt.Sprintf(" AND method = '%s'", filter)
	}

	query += `
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`;

	rows, err := r.db.Query(ctx, query, proofSetID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query txs: %w", err)
	}
	defer rows.Close()

	var txs []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(
			&tx.ProofSetID,
			&tx.Hash,
			&tx.MessageID,
			&tx.Height,
			&tx.FromAddress,
			&tx.ToAddress,
			&tx.Value,
			&tx.Method,
			&tx.Status,
			&tx.BlockNumber,
			&tx.BlockHash,
			&tx.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan tx: %w", err)
		}
		txs = append(txs, tx)
	}

	return txs, total, nil
}

// GetProofSetRoots retrieves roots for a specific proof set with pagination
func (r *Repository) GetProofSetRoots(ctx context.Context, proofSetID string, offset, limit int) ([]Root, int, error) {
	// Get total count of event logs
	var total int
	totalFilterQuery := `
		SELECT COUNT(*) 
		FROM (
			SELECT DISTINCT ON (root_id) root_id
			FROM roots
			WHERE set_id = $1
			ORDER BY root_id, block_number DESC
		) AS unique_roots
	`
	err := r.db.QueryRow(ctx, totalFilterQuery, proofSetID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get roots count: %w", err)
	}

	query := `
		WITH LatestRoots AS (
			SELECT DISTINCT ON (root_id) *
			FROM roots
			WHERE set_id = $1
			ORDER BY root_id, block_number DESC
		)
		SELECT 
			root_id,
			cid,
			raw_size,
			removed,
			total_periods_faulted,
			total_proofs_submitted,
			last_proven_epoch,
			last_proven_at,
			last_faulted_epoch,
			last_faulted_at,
			created_at
		FROM LatestRoots
		ORDER BY root_id
		LIMIT $2 OFFSET $3
	`;
	// Get roots
	rows, err := r.db.Query(ctx, query, proofSetID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query roots: %w", err)
	}
	defer rows.Close()

	var roots []Root
	for rows.Next() {
		var root Root
		err := rows.Scan(
			&root.RootId,
			&root.Cid,
			&root.RawSize,
			&root.Removed,
			&root.TotalPeriodsFaulted,
			&root.TotalProofsSubmitted,
			&root.LastProvenEpoch,
			&root.LastProvenAt,
			&root.LastFaultedEpoch,
			&root.LastFaultedAt,
			&root.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan root: %w", err)
		}
		roots = append(roots, root)
	}

	return roots, total, nil
}