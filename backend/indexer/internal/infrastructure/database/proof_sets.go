package database

import (
	"context"
	"fmt"
	"math/big"

	"pdp-explorer-indexer/internal/models"
)

// StoreProofSet stores a proof set record with version control
func (p *PostgresDB) StoreProofSet(ctx context.Context, proofSet *models.ProofSet) error {
	_, err := p.pool.Exec(ctx, `
		INSERT INTO proof_sets (
			set_id, owner, listener_addr, total_faulted_periods, total_data_size,
			total_roots, total_fee_paid, last_proven_epoch, next_challenge_epoch,
			total_transactions, is_active, block_number, block_hash, created_at, updated_at, total_proved_roots
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		ON CONFLICT (set_id, block_number) DO UPDATE SET 
			owner = EXCLUDED.owner,
			listener_addr = EXCLUDED.listener_addr,
			total_faulted_periods = EXCLUDED.total_faulted_periods,
			total_data_size = EXCLUDED.total_data_size,
			total_roots = EXCLUDED.total_roots,
			total_fee_paid = EXCLUDED.total_fee_paid,
			last_proven_epoch = EXCLUDED.last_proven_epoch,
			next_challenge_epoch = EXCLUDED.next_challenge_epoch,
			total_transactions = EXCLUDED.total_transactions,
			is_active = EXCLUDED.is_active,
			block_hash = EXCLUDED.block_hash,
			updated_at = EXCLUDED.updated_at,
			total_proved_roots = EXCLUDED.total_proved_roots
	`, proofSet.SetId, proofSet.Owner, proofSet.ListenerAddr, proofSet.TotalFaultedPeriods,
		proofSet.TotalDataSize, proofSet.TotalRoots, proofSet.TotalFeePaid,
		proofSet.LastProvenEpoch, proofSet.NextChallengeEpoch, proofSet.TotalTransactions,
		proofSet.IsActive, proofSet.BlockNumber, proofSet.BlockHash, proofSet.CreatedAt, proofSet.UpdatedAt, proofSet.TotalProvedRoots)
	if err != nil {
		return fmt.Errorf("failed to insert proof set: %w", err)
	}

	return nil
}

// FindProofSet finds a proof set by its set_id, optionally including historical versions
func (p *PostgresDB) FindProofSet(ctx context.Context, setId int64, includeHistory bool) ([]*models.ProofSet, error) {
	query := `
		SELECT id, set_id, owner, listener_addr, total_faulted_periods, total_proved_roots, total_data_size,
			   total_roots, total_fee_paid, last_proven_epoch, next_challenge_epoch,
			   total_transactions, is_active, block_number, block_hash, created_at
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

	var proofSets []*models.ProofSet
	for rows.Next() {
		ps := &models.ProofSet{}
		var totalFeePaidInt int64
		err := rows.Scan(
			&ps.ID, &ps.SetId, &ps.Owner, &ps.ListenerAddr, &ps.TotalFaultedPeriods,
			&ps.TotalProvedRoots, &ps.TotalDataSize, &ps.TotalRoots, &totalFeePaidInt,
			&ps.LastProvenEpoch, &ps.NextChallengeEpoch, &ps.TotalTransactions,
			&ps.IsActive, &ps.BlockNumber, &ps.BlockHash, &ps.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan proof set: %w", err)
		}
		ps.TotalFeePaid = new(big.Int).SetInt64(totalFeePaidInt)
		proofSets = append(proofSets, ps)
	}

	return proofSets, nil
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
		WITH finalized_latest_versions AS (
			SELECT DISTINCT ON (set_id) id
			FROM proof_sets
			WHERE is_block_finalized(block_number, $1)
			ORDER BY set_id, block_number DESC
		),
		finalized_duplicates AS (
			SELECT ps.id
			FROM proof_sets ps
			WHERE ps.id NOT IN (SELECT id FROM finalized_latest_versions)
				AND is_block_finalized(ps.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM proof_sets newer
					WHERE newer.id IN (SELECT id FROM finalized_latest_versions)
						AND newer.set_id = ps.set_id
				)
		)
		DELETE FROM proof_sets
		WHERE id IN (SELECT id FROM finalized_duplicates)`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized proof sets: %w", err)
	}
	return nil
}