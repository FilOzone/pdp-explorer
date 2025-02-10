package database

import (
	"context"
	"fmt"
	"pdp-explorer-indexer/internal/models"

	"github.com/jackc/pgx/v5"
)

// SaveBlock saves a block to the database
func (db *PostgresDB) SaveBlock(ctx context.Context, block *models.Block) error {
	_, err := db.pool.Exec(ctx, `
        INSERT INTO blocks (height, hash, parent_hash, is_processed, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (height) DO UPDATE
        SET hash = EXCLUDED.hash,
            parent_hash = EXCLUDED.parent_hash,
            timestamp = EXCLUDED.timestamp
    `, block.Height, block.Hash, block.ParentHash, block.IsProcessed, block.Timestamp)

	if err != nil {
		return fmt.Errorf("failed to save block: %w", err)
	}
	return nil
}

// UpdateBlockProcessingState updates the processing state of a block
func (db *PostgresDB) UpdateBlockProcessingState(ctx context.Context, height int64, isProcessed bool) error {
	_, err := db.pool.Exec(ctx, `
        UPDATE blocks 
        SET is_processed = $2
        WHERE height = $1
    `, height, isProcessed)

	if err != nil {
		return fmt.Errorf("failed to update block processing state: %w", err)
	}
	return nil
}

// GetLastBlock retrieves the latest block
func (db *PostgresDB) GetLastProcessedBlock(ctx context.Context) (int64, error) {
	var block models.Block
	err := db.pool.QueryRow(ctx, `
        SELECT height, hash, parent_hash, timestamp, created_at 
        FROM blocks 
        WHERE is_processed = true
        ORDER BY height DESC 
        LIMIT 1
    `).Scan(&block.Height, &block.Hash, &block.ParentHash, &block.Timestamp, &block.CreatedAt)

	if err == pgx.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get last block: %w", err)
	}
	return block.Height, nil
}

// GetBlockByHeight retrieves a block by its height
func (db *PostgresDB) GetBlockByHeight(ctx context.Context, height uint64) (*models.Block, error) {
	var block models.Block
	err := db.pool.QueryRow(ctx, `
        SELECT height, hash, parent_hash, timestamp, created_at 
        FROM blocks 
        WHERE height = $1
    `, height).Scan(&block.Height, &block.Hash, &block.ParentHash, &block.Timestamp, &block.CreatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get block: %w", err)
	}
	return &block, nil
}


// Cleanup Finalized blocks (remove blocks that are more than 1000 blocks old)
func (db *PostgresDB) CleanupFinalizedBlocks(ctx context.Context, currentHeight uint64) error {
  _, err := db.pool.Exec(ctx, `
		DELETE FROM blocks 
		WHERE height < $1 - 1000
	`, currentHeight)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized blocks: %w", err)
	}
	return nil
}

