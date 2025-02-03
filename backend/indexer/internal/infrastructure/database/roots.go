package database

import (
	"context"
	"fmt"
	"time"

	"pdp-explorer-indexer/internal/processor"

	"github.com/jackc/pgx/v5"
)

// StoreRoot stores a new root in the database or updates an existing one
func (db *PostgresDB) StoreRoot(ctx context.Context, root *processor.Root) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
			INSERT INTO roots (
				set_id, root_id, raw_size, cid, removed,
				block_number, block_hash,
				created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
		root.SetId, root.RootId, root.RawSize, root.Cid, root.Removed,
		root.BlockNumber, root.BlockHash, root.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to store root: %w", err)
	}

	return tx.Commit(ctx)
}

// FindRootBySetId finds a root by its setId
func (db *PostgresDB) FindRootBySetId(ctx context.Context, setId int64) (*processor.Root, error) {
	var root processor.Root
	err := db.pool.QueryRow(ctx, `
		SELECT id, set_id, root_id, raw_size, cid, removed,
		       block_number, block_hash, previous_id,
		       created_at, updated_at
		FROM roots 
		WHERE set_id = $1
		ORDER BY is_latest DESC
		LIMIT 1`,
		setId).Scan(
		&root.ID, &root.SetId, &root.RootId,
		&root.RawSize, &root.Cid, &root.Removed,
		&root.BlockNumber, &root.BlockHash, &root.PreviousID,
		&root.CreatedAt, &root.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find root: %w", err)
	}

	return &root, nil
}

// FindRoot finds a specific root by its setId and rootId
func (db *PostgresDB) FindRoot(ctx context.Context, setId, rootId int64) (*processor.Root, error) {
	query := `
		SELECT 
			set_id,
			root_id,
			raw_size,
			cid,
			removed,
			created_at,
			updated_at,
			block_number,
			block_hash,
		FROM roots
		WHERE set_id = $1 AND root_id = $2
		ORDER BY block_number DESC
		LIMIT 1`

	root := &processor.Root{}
	err := db.pool.QueryRow(ctx, query, setId, rootId).Scan(
		&root.SetId,
		&root.RootId,
		&root.RawSize,
		&root.Cid,
		&root.Removed,
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

// UpdateRootRemoved updates the removed status of a root
func (db *PostgresDB) UpdateRootRemoved(ctx context.Context, setId int64, rootId int64, removed bool, blockNumber uint64, blockHash string, timestamp time.Time) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get the current version of the root
	existingRoot, err := db.FindRoot(ctx, setId, rootId)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("root not found")
		}
		return fmt.Errorf("error finding root: %w", err)
	}

	// Create new version with updated removed status
	_, err = tx.Exec(ctx, `
		WITH current_version AS (
			UPDATE roots 
			SET is_latest = false
			WHERE id = $1
			RETURNING id
		)
		INSERT INTO roots (
			set_id, root_id, raw_size, cid, removed,
			block_number, block_hash, is_latest, previous_id,
			created_at, updated_at
		) VALUES ($2, $3, $4, $5, $6, $7, $8, true, $1, $9, $9)`,
		existingRoot.ID,
		existingRoot.SetId, existingRoot.RootId,
		existingRoot.RawSize, existingRoot.Cid, removed,
		blockNumber, blockHash, timestamp)

	if err != nil {
		return fmt.Errorf("failed to update root removed status: %w", err)
	}

	return tx.Commit(ctx)
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
		WITH latest_versions AS (
			SELECT DISTINCT ON (set_id, root_id) id
			FROM roots
			ORDER BY set_id, root_id, block_number DESC
		),
		finalized_duplicates AS (
			SELECT r.id
			FROM roots r
			WHERE r.id NOT IN (SELECT id FROM latest_versions)
				AND is_block_finalized(r.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM roots newer
					WHERE newer.previous_id = r.id
						AND newer.id IN (SELECT id FROM latest_versions)
						AND is_block_finalized(newer.block_number, $1)
				)
		)
		DELETE FROM roots r
		USING finalized_duplicates fd
		WHERE r.id = fd.id`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized roots: %w", err)
	}
	return nil
}

// UpdateRootProofStats updates the proof stats for a root
func (db *PostgresDB) UpdateRootProofStats(ctx context.Context, setId int64, rootId int64, blockNumber uint64, blockHash string, timestamp time.Time) error {
	tx, err := db.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Mark existing version as not latest
	root, err := db.FindRoot(ctx, setId, rootId)
	if err != nil {
		return fmt.Errorf("failed to find root: %w", err)
	}

	// Insert new version with updated stats
	_, err = tx.Exec(ctx, `
		INSERT INTO roots (
			set_id, root_id, raw_size, cid, removed,
			total_proofs, total_faults, last_proven_epoch,
			last_faulted_epoch, block_number, block_hash,
			previous_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
	`, root.SetId, root.RootId, root.RawSize, root.Cid,
		root.Removed, root.TotalProofs+1, root.TotalFaults,
		blockNumber, root.LastFaultedEpoch, blockNumber,
		blockHash, root.ID)
	if err != nil {
		return fmt.Errorf("failed to insert root: %w", err)
	}

	return tx.Commit(ctx)
}
