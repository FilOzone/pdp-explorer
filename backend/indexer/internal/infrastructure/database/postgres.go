package database

import (
	"context"
	"fmt"
	"time"

	"pdp-explorer-indexer/internal/infrastructure/config"
	"pdp-explorer-indexer/internal/processor"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresDB struct {
	pool *pgxpool.Pool
}

func NewPostgresDB(cfg *config.Config) (*PostgresDB, error) {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %v", err)
	}

	return &PostgresDB{pool: pool}, nil
}

func (db *PostgresDB) Close() {
	db.pool.Close()
}

func (p *PostgresDB) ExecContext(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error) {
	return p.pool.Exec(ctx, query, args...)
}

func (p *PostgresDB) QueryRow(query string, args ...interface{}) pgx.Row {
	return p.pool.QueryRow(context.Background(), query, args...)
}

type Block struct {
    Height     int64    `db:"height"`
    Hash       string    `db:"hash"`
    ParentHash string    `db:"parent_hash"`
    Timestamp  uint64    `db:"timestamp"`
    IsProcessed bool     `db:"is_processed"`
    CreatedAt  time.Time `db:"created_at"`
}

// GetLastBlock retrieves the latest block
func (db *PostgresDB) GetLastProcessedBlock(ctx context.Context) (int64, error) {
    var block Block
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
func (db *PostgresDB) GetBlockByHeight(ctx context.Context, height uint64) (*Block, error) {
    var block Block
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

// SaveBlock saves a block to the database
func (db *PostgresDB) SaveBlock(ctx context.Context, block *Block) error {
    _, err := db.pool.Exec(ctx, `
        INSERT INTO blocks (height, hash, parent_hash, is_processed, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (height) DO UPDATE
        SET hash = EXCLUDED.hash,
            parent_hash = EXCLUDED.parent_hash,
            timestamp = EXCLUDED.timestamp
    `, block.Height, block.Hash, block.ParentHash, block.IsProcessed, block.Timestamp,)
    
    if err != nil {
        return fmt.Errorf("failed to save block: %w", err)
    }
    return nil
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

type Transaction interface {
    Commit(ctx context.Context) error
    Rollback(ctx context.Context) error
    MoveToReorgedBlocks(ctx context.Context, startHeight, endHeight uint64) error
    SaveBlock(ctx context.Context, block *Block) error
}

// PostgresTx implements the Transaction interface
type PostgresTx struct {
    tx pgx.Tx
}

func (db *PostgresDB) BeginTx(ctx context.Context) (Transaction, error) {
    tx, err := db.pool.Begin(ctx)
    if err != nil {
        return nil, fmt.Errorf("failed to begin transaction: %w", err)
    }
    return &PostgresTx{tx: tx}, nil
}

func (t *PostgresTx) Commit(ctx context.Context) error {
    return t.tx.Commit(ctx)
}

func (t *PostgresTx) Rollback(ctx context.Context) error {
    return t.tx.Rollback(ctx)
}

func (t *PostgresTx) MoveToReorgedBlocks(ctx context.Context, startHeight, endHeight uint64) error {
    // Move blocks to reorged_blocks table
    _, err := t.tx.Exec(ctx, `
        INSERT INTO reorged_blocks (height, hash, parent_hash, original_block_data)
        SELECT height, hash, parent_hash, 
               jsonb_build_object(
                   'height', height,
                   'hash', hash,
                   'parent_hash', parent_hash
               )
        FROM blocks
        WHERE height BETWEEN $1 AND $2
    `, startHeight, endHeight)
    if err != nil {
        return fmt.Errorf("failed to copy blocks to reorged_blocks: %w", err)
    }

    // Delete from blocks table
    _, err = t.tx.Exec(ctx, `
        DELETE FROM blocks
        WHERE height BETWEEN $1 AND $2
    `, startHeight, endHeight)
    if err != nil {
        return fmt.Errorf("failed to delete blocks: %w", err)
    }

    return nil
}

func (t *PostgresTx) SaveBlock(ctx context.Context, block *Block) error {
    _, err := t.tx.Exec(ctx, `
        INSERT INTO blocks (height, hash, parent_hash, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (height) DO UPDATE SET
            hash = EXCLUDED.hash,
            parent_hash = EXCLUDED.parent_hash,
            timestamp = EXCLUDED.timestamp
    `, block.Height, block.Hash, block.ParentHash, block.Timestamp, block.CreatedAt)
    
    if err != nil {
        return fmt.Errorf("failed to save block: %w", err)
    }
    return nil
}

// StoreTransfer stores a WFIL transfer record with version control
func (p *PostgresDB) StoreTransfer(ctx context.Context, transfer *processor.Transfer) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check if this transfer already exists and needs an update
	var existingID int64
	err = tx.QueryRow(ctx, `
		SELECT id FROM transfers 
		WHERE tx_hash = $1 AND log_index = $2 AND is_latest = true`,
		transfer.TxHash, transfer.LogIndex).Scan(&existingID)

	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to check existing transfer: %w", err)
	}

	if err == pgx.ErrNoRows {
		// New transfer - insert directly
		_, err = tx.Exec(ctx, `
			INSERT INTO transfers (
				from_address, to_address, amount, tx_hash, 
				block_number, block_hash, log_index, is_latest
			) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
			transfer.FromAddress,
			transfer.ToAddress,
			transfer.Amount.String(),
			transfer.TxHash,
			transfer.BlockNumber,
			transfer.BlockHash,
			transfer.LogIndex,
		)
	} else {
		// Existing transfer - update by creating new version
		_, err = tx.Exec(ctx, `
			WITH current_version AS (
				UPDATE transfers 
				SET is_latest = false
				WHERE id = $1
				RETURNING id
			)
			INSERT INTO transfers (
				from_address, to_address, amount, tx_hash,
				block_number, block_hash, log_index, is_latest, previous_id
			) VALUES ($2, $3, $4, $5, $6, $7, $8, true, $1)`,
			existingID,
			transfer.FromAddress,
			transfer.ToAddress,
			transfer.Amount.String(),
			transfer.TxHash,
			transfer.BlockNumber,
			transfer.BlockHash,
			transfer.LogIndex,
		)
	}

	if err != nil {
		return fmt.Errorf("failed to store transfer: %w", err)
	}

	return tx.Commit(ctx)
}

// DeleteReorgedTransfers removes transfers from reorged blocks
func (p *PostgresDB) DeleteReorgedTransfers(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM transfers
		WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)
	
	if err != nil {
		return fmt.Errorf("failed to delete reorged transfers: %w", err)
	}
	return nil
}

// RestorePreviousTransfers restores previous versions of transfers before the reorg point
func (p *PostgresDB) RestorePreviousTransfers(ctx context.Context, startHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		WITH transfers_to_restore AS (
			SELECT DISTINCT ON (t.tx_hash, t.log_index) 
				t.id,
				t.previous_id
			FROM transfers t
			WHERE t.block_number < $1
				AND t.is_latest = false
				AND EXISTS (
					SELECT 1 
					FROM transfers newer
					WHERE newer.previous_id = t.id
						AND newer.block_number >= $1
				)
			ORDER BY t.tx_hash, t.log_index, t.block_number DESC
		)
		UPDATE transfers t
		SET is_latest = true
		FROM transfers_to_restore r
		WHERE t.id = r.id`,
		startHeight)

	if err != nil {
		return fmt.Errorf("failed to restore previous transfers: %w", err)
	}
	return nil
}

// CleanupFinalizedTransfers removes unnecessary historical versions of transfers in finalized blocks
func (p *PostgresDB) CleanupFinalizedTransfers(ctx context.Context, currentBlockNumber uint64) error {
	_, err := p.pool.Exec(ctx, `
		WITH finalized_duplicates AS (
			SELECT t.id
			FROM transfers t
			WHERE NOT t.is_latest
				AND is_block_finalized(t.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM transfers newer
					WHERE newer.previous_id = t.id
						AND newer.is_latest
						AND is_block_finalized(newer.block_number, $1)
				)
		)
		DELETE FROM transfers t
		USING finalized_duplicates fd
		WHERE t.id = fd.id`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized transfers: %w", err)
	}
	return nil
}
