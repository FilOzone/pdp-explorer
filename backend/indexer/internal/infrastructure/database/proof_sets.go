package database

import (
	"context"
	"fmt"
	"pdp-explorer-indexer/internal/processor"
	"time"
)

// StoreProofSet stores a proof set record with version control
func (p *PostgresDB) StoreProofSet(ctx context.Context, proofSet *processor.ProofSet) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get the ID of the previous version to maintain history
	var previousID *int64
	err = tx.QueryRow(ctx, `
		SELECT id FROM proof_sets 
		WHERE set_id = $1 
		ORDER BY block_number DESC 
		LIMIT 1
	`, proofSet.SetId).Scan(&previousID)
	if err != nil {
		// If no previous version exists, that's fine
		previousID = nil
	}

	// Insert the new version
	_, err = tx.Exec(ctx, `
		INSERT INTO proof_sets (
			set_id, owner, listener_addr, total_faulted_periods, total_data_size,
			total_roots, total_fee_paid, last_proven_epoch, next_challenge_epoch,
			total_transactions, is_active, block_number, block_hash,
			previous_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)
	`, proofSet.SetId, proofSet.Owner, proofSet.ListenerAddr, proofSet.TotalFaultedPeriods,
		proofSet.TotalDataSize, proofSet.TotalRoots, proofSet.TotalFeePaid,
		proofSet.LastProvenEpoch, proofSet.NextChallengeEpoch, proofSet.TotalTransactions,
		proofSet.IsActive, proofSet.BlockNumber, proofSet.BlockHash, previousID)
	if err != nil {
		return fmt.Errorf("failed to insert proof set: %w", err)
	}

	return tx.Commit(ctx)
}

// FindProofSet finds a proof set by its set_id, optionally including historical versions
func (p *PostgresDB) FindProofSet(ctx context.Context, setId int64, includeHistory bool) ([]*processor.ProofSet, error) {
	query := `
		SELECT id, set_id, owner, listener_addr, total_faulted_periods, total_data_size,
			   total_roots, total_fee_paid, last_proven_epoch, next_challenge_epoch,
			   total_transactions, is_active, block_number, block_hash,
			   previous_id
		FROM proof_sets
		WHERE set_id = $1
	`
	query += " ORDER BY block_number DESC"
	if !includeHistory {
		query += " LIMIT 1"
	}

	rows, err := p.pool.Query(ctx, query, setId)
	if err != nil {
		return nil, fmt.Errorf("failed to query proof sets: %w", err)
	}
	defer rows.Close()

	var proofSets []*processor.ProofSet
	for rows.Next() {
		ps := &processor.ProofSet{}
		err := rows.Scan(
			&ps.ID, &ps.SetId, &ps.Owner, &ps.ListenerAddr, &ps.TotalFaultedPeriods,
			&ps.TotalDataSize, &ps.TotalRoots, &ps.TotalFeePaid,
			&ps.LastProvenEpoch, &ps.NextChallengeEpoch, &ps.TotalTransactions,
			&ps.IsActive, &ps.BlockNumber, &ps.BlockHash, &ps.PreviousID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan proof set: %w", err)
		}
		proofSets = append(proofSets, ps)
	}

	return proofSets, nil
}

// UpdateProofSet updates an existing proof set while maintaining version history
func (p *PostgresDB) UpdateProofSet(ctx context.Context, proofSet *processor.ProofSet) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get the ID of the current version to maintain history
	var previousID = proofSet.ID

	// Insert the new version
	_, err = tx.Exec(ctx, `
		INSERT INTO proof_sets (
			set_id, owner, listener_addr, total_faulted_periods, total_data_size,
			total_roots, total_fee_paid, last_proven_epoch, next_challenge_epoch,
			total_transactions, is_active, block_number, block_hash, previous_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)
	`, proofSet.SetId, proofSet.Owner, proofSet.ListenerAddr, proofSet.TotalFaultedPeriods,
		proofSet.TotalDataSize, proofSet.TotalRoots, proofSet.TotalFeePaid,
		proofSet.LastProvenEpoch, proofSet.NextChallengeEpoch, proofSet.TotalTransactions,
		proofSet.IsActive, proofSet.BlockNumber, proofSet.BlockHash, previousID)
	if err != nil {
		return fmt.Errorf("failed to insert updated proof set: %w", err)
	}

	return tx.Commit(ctx)
}

// DeleteReorgedProofSets removes proof sets from reorged blocks
func (p *PostgresDB) DeleteReorgedProofSets(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM proof_sets 
		WHERE block_number BETWEEN $1 AND $2
	`, startHeight, endHeight)
	if err != nil {
		return fmt.Errorf("failed to delete reorged proof sets: %w", err)
	}
	return nil
}

// CleanupFinalizedProofSets removes unnecessary historical versions of proof sets in finalized blocks
func (p *PostgresDB) CleanupFinalizedProofSets(ctx context.Context, currentBlockNumber uint64) error {
	_, err := p.pool.Exec(ctx, `
		WITH latest_versions AS (
			SELECT DISTINCT ON (set_id) id
			FROM proof_sets
			ORDER BY set_id, block_number DESC
		),
		finalized_duplicates AS (
			SELECT ps.id
			FROM proof_sets ps
			WHERE ps.id NOT IN (SELECT id FROM latest_versions)
				AND is_block_finalized(ps.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM proof_sets newer
					WHERE newer.previous_id = ps.id
						AND newer.id IN (SELECT id FROM latest_versions)
						AND is_block_finalized(newer.block_number, $1)
				)
		)
		DELETE FROM proof_sets ps
		USING finalized_duplicates fd
		WHERE ps.id = fd.id`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized proof sets: %w", err)
	}
	return nil
}

// IncrementTotalRoots increments the total_roots and total_data_size for a proof set
func (db *PostgresDB) IncrementTotalRoots(ctx context.Context, setId int64, amount int64, totalDataSize int64, timestamp time.Time) error {
	proofSet, err := db.FindProofSet(ctx, setId, false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	proofSet[0].TotalRoots += amount
	proofSet[0].TotalDataSize += totalDataSize
	proofSet[0].UpdatedAt = timestamp

	if err := db.UpdateProofSet(ctx, proofSet[0]); err != nil {
		return fmt.Errorf("failed to update proof set: %w", err)
	}

	return nil
}

// DecrementTotalRoots decrements the total_roots and total_data_size for a proof set
func (db *PostgresDB) DecrementTotalRoots(ctx context.Context, setId int64, amount int64, totalDataSize int64, timestamp time.Time) error {
	proofSet, err := db.FindProofSet(ctx, setId, false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	proofSet[0].TotalRoots -= amount
	proofSet[0].TotalDataSize -= totalDataSize
	proofSet[0].UpdatedAt = timestamp

	if err := db.UpdateProofSet(ctx, proofSet[0]); err != nil {
		return fmt.Errorf("failed to update proof set: %w", err)
	}

	return nil
}

// MarkProofSetDeleted marks a proof set as deleted by updating its fields
func (db *PostgresDB) MarkProofSetDeleted(ctx context.Context, setId int64, blockNumber uint64, blockHash string, timestamp time.Time) error {
	query := `
		WITH old_version AS (
			WHERE set_id = $1
			ORDER BY block_number DESC
			LIMIT 1
			RETURNING *
		)
		INSERT INTO proof_sets (
			set_id,
			owner,
			total_roots,
			total_data_size,
			is_active,
			next_challenge_epoch,
			last_proven_epoch,
			created_at,
			updated_at,
			block_number,
			block_hash
		)
		SELECT
			set_id,
			'0x0000000000000000000000000000000000000000', -- zero address
			0, -- total_roots
			0, -- total_data_size
			false, -- is_active
			0, -- next_challenge_epoch
			0, -- last_proven_epoch
			created_at,
			$4, -- updated_at
			$2, -- block_number
			$3  -- block_hash
		FROM old_version;`

	commandTag, err := db.pool.Exec(ctx, query, setId, blockNumber, blockHash, timestamp)
	if err != nil {
		return fmt.Errorf("failed to mark proof set as deleted: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("no proof set found")
	}

	return nil
}

// MarkProofSetEmpty marks a proof set as empty by updating its fields
func (db *PostgresDB) MarkProofSetEmpty(ctx context.Context, setId int64, blockNumber uint64, blockHash string, timestamp time.Time) error {
	query := `
		WITH old_version AS (
			WHERE set_id = $1
			ORDER BY block_number DESC
			LIMIT 1
			RETURNING *
		)
		INSERT INTO proof_sets (
			set_id,
			owner,
			total_roots,
			total_data_size,
			is_active,
			next_challenge_epoch,
			last_proven_epoch,
			created_at,
			updated_at,
			block_number,
			block_hash
		)
		SELECT
			set_id,
			owner,
			total_roots,
			total_data_size,
			true,
			0,
			0, 
			created_at,
			$4,
			$2,
			$3
		FROM old_version;`

	commandTag, err := db.pool.Exec(ctx, query, setId, blockNumber, blockHash, timestamp)
	if err != nil {
		return fmt.Errorf("failed to mark proof set as empty: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("no proof set found")
	}

	return nil
}

// UpdateNextChallengeEpoch updates the next_challenge_epoch for a proof set
func (db *PostgresDB) UpdateNextChallengeEpoch(ctx context.Context, setId int64, epoch int64, blockNumber uint64, blockHash string) error {
	query := `
		WITH old_version AS (
			WHERE set_id = $1
			ORDER BY block_number DESC
			LIMIT 1
			RETURNING *
		)
		INSERT INTO proof_sets (
			set_id,
			owner,
			total_roots,
			total_data_size,
			is_active,
			next_challenge_epoch,
			last_proven_epoch,
			created_at,
			updated_at,
			block_number,
			block_hash
		)
		SELECT
			set_id,
			owner,
			total_roots,
			total_data_size,
			is_active,
			$2, -- next_challenge_epoch
			last_proven_epoch,
			created_at,
			NOW(),
			$3, -- block_number
			$4 -- block_hash
		FROM old_version;`

	commandTag, err := db.pool.Exec(ctx, query, setId, epoch, blockNumber, blockHash)
	if err != nil {
		return fmt.Errorf("failed to update next challenge epoch: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("no proof set found")
	}

	return nil
}

// UpdateProofSetOwner updates the owner of a proof set and maintains version history
func (db *PostgresDB) UpdateProofSetOwner(ctx context.Context, setId int64, newOwner string, blockNumber uint64, blockHash string) error {
	query := `
		WITH old_version AS (
			WHERE set_id = $1
			ORDER BY block_number DESC
			LIMIT 1
			RETURNING *
		)
		INSERT INTO proof_sets (
			set_id,
			owner,
			total_roots,
			total_data_size,
			is_active,
			next_challenge_epoch,
			last_proven_epoch,
			created_at,
			updated_at,
			block_number,
			block_hash,
			listener_addr
		)
		SELECT
			set_id,
			$2, -- new owner
			total_roots,
			total_data_size,
			is_active,
			next_challenge_epoch,
			last_proven_epoch,
			created_at,
			NOW(),
			$3, -- block_number
			$4 -- block_hash
			listener_addr
		FROM old_version;`

	commandTag, err := db.pool.Exec(ctx, query, setId, newOwner, blockNumber, blockHash)
	if err != nil {
		return fmt.Errorf("failed to update proof set owner: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		return fmt.Errorf("no proof set found")
	}

	return nil
}

// UpdateProofSetStats updates the proof stats for a proof set
func (db *PostgresDB) UpdateProofSetStats(ctx context.Context, setId int64, proofsSubmitted int64, periodsFaulted int64, blockNumber uint64, blockHash string, timestamp time.Time) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	proofSets, err := db.FindProofSet(ctx, setId, false)
	if err != nil {
		return fmt.Errorf("failed to find proof set: %w", err)
	}

	if len(proofSets) == 0 {
		return fmt.Errorf("no proof set found")
	}

	proofSet := proofSets[0]
	previousID := proofSet.ID

	// Insert new version with updated stats
	_, err = tx.Exec(ctx, `
		INSERT INTO proof_sets (
			set_id, owner, listener_addr, total_faulted_periods,
			total_data_size, total_roots, total_proved_roots, total_fee_paid,
			last_proven_epoch, next_challenge_epoch, total_transactions,
			is_active, block_number, block_hash, is_latest, previous_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14
		)
	`, proofSet.SetId, proofSet.Owner, proofSet.ListenerAddr,
		proofSet.TotalFaultedPeriods+periodsFaulted, proofSet.TotalDataSize,
		proofSet.TotalRoots, int64(proofSet.TotalProvedRoots)+int64(proofsSubmitted), proofSet.TotalFeePaid,
		blockNumber, proofSet.NextChallengeEpoch,
		proofSet.TotalTransactions, proofSet.IsActive,
		blockNumber, blockHash, previousID)
	if err != nil {
		return fmt.Errorf("failed to insert proof set: %w", err)
	}

	return tx.Commit(ctx)
}
