package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/models"

	"github.com/jackc/pgx/v5"
)

// StoreRoot stores a new root in the database or updates an existing one
func (db *PostgresDB) StoreRoot(ctx context.Context, root *models.Root) error {
	_, err := db.pool.Exec(ctx, `
			INSERT INTO roots (
				set_id, root_id, raw_size, cid, removed,
				block_number, block_hash,
				created_at, updated_at,
				total_proofs, total_faults, last_proven_epoch, last_faulted_epoch
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (set_id, root_id, block_number) DO UPDATE SET
				removed = EXCLUDED.removed,
				cid = EXCLUDED.cid, 
				raw_size = EXCLUDED.raw_size,
				updated_at = EXCLUDED.updated_at,
				block_hash = EXCLUDED.block_hash,
				total_proofs = EXCLUDED.total_proofs,
				total_faults = EXCLUDED.total_faults,
				last_proven_epoch = EXCLUDED.last_proven_epoch,
				last_faulted_epoch = EXCLUDED.last_faulted_epoch
			`,
		root.SetId, root.RootId, root.RawSize, root.Cid, root.Removed,
		root.BlockNumber, root.BlockHash, root.CreatedAt, root.UpdatedAt,
		root.TotalProofs, root.TotalFaults, root.LastProvenEpoch, root.LastFaultedEpoch)

	if err != nil {
		return fmt.Errorf("failed to store root: %w", err)
	}

	return nil
}

// FindRoot finds a specific root by its setId and rootId
func (db *PostgresDB) FindRoot(ctx context.Context, setId, rootId int64) (*models.Root, error) {
	query := `
		SELECT
			id,
			set_id,
			root_id,
			raw_size,
			cid,
			removed,
			total_proofs,
			total_faults,
			last_proven_epoch,
			last_faulted_epoch,
			created_at,
			updated_at,
			block_number,
			block_hash
		FROM roots
		WHERE set_id = $1 AND root_id = $2
		ORDER BY block_number DESC
		LIMIT 1`

	root := &models.Root{}
	err := db.pool.QueryRow(ctx, query, setId, rootId).Scan(
		&root.ID,
		&root.SetId,
		&root.RootId,
		&root.RawSize,
		&root.Cid,
		&root.Removed,
		&root.TotalProofs,
		&root.TotalFaults,
		&root.LastProvenEpoch,
		&root.LastFaultedEpoch,
		&root.CreatedAt,
		&root.UpdatedAt,
		&root.BlockNumber,
		&root.BlockHash,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("root not found")
		}
		return nil, fmt.Errorf("error finding root: %w", err)
	}

	return root, nil
}

// DeleteReorgedRoots deletes all roots after the given block number
func (db *PostgresDB) DeleteReorgedRoots(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := db.pool.Exec(ctx, `
		DELETE FROM roots 
		WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)
	if err != nil {
		return fmt.Errorf("failed to delete reorged roots: %w", err)
	}
	return nil
}

// CleanupFinalizedRoots removes unnecessary historical versions of roots in finalized blocks
func (db *PostgresDB) CleanupFinalizedRoots(ctx context.Context, currentBlockNumber uint64) error {
	_, err := db.pool.Exec(ctx, `
		WITH finalized_latest_versions AS (
			SELECT DISTINCT ON (set_id, root_id) id
			FROM roots
			WHERE is_block_finalized(block_number, $1)
			ORDER BY set_id, root_id, block_number DESC
		),
		finalized_duplicates AS (
			SELECT r.id
			FROM roots r
			WHERE r.id NOT IN (SELECT id FROM finalized_latest_versions)
				AND is_block_finalized(r.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM roots newer
					WHERE newer.id IN (SELECT id FROM finalized_latest_versions)
						AND newer.set_id = r.set_id
						AND newer.root_id = r.root_id
				)
		)
		DELETE FROM roots
		WHERE id IN (SELECT id FROM finalized_duplicates)`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized roots: %w", err)
	}
	return nil
}