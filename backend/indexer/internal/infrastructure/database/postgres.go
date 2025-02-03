package database

import (
	"context"
	"fmt"
	"time"

	"pdp-explorer-indexer/internal/infrastructure/config"

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
	Height      int64     `db:"height"`
	Hash        string    `db:"hash"`
	ParentHash  string    `db:"parent_hash"`
	Timestamp   uint64    `db:"timestamp"`
	IsProcessed bool      `db:"is_processed"`
	CreatedAt   time.Time `db:"created_at"`
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
    `, block.Height, block.Hash, block.ParentHash, block.IsProcessed, block.Timestamp)

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

// DeleteReorgedData removes data from reorged blocks
func (p *PostgresDB) DeleteReorgedData(ctx context.Context, startHeight, endHeight uint64) error {
	// Delete Reorged Data from all the tables (providers, proof_sets, proofs, roots, proof_fees, event_logs, transactions, fault_records)

	// Providers
	if err := p.DeleteReorgedProviders(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged providers: %w", err)
	}

	// Proof sets
	if err := p.DeleteReorgedProofSets(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged proof sets: %w", err)
	}

	// Proofs
	if err := p.DeleteReorgedProofs(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged proofs: %w", err)
	}

	// Fault records
	if err := p.DeleteReorgedFaultRecords(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged fault records: %w", err)
	}

	// Roots
	if err := p.DeleteReorgedRoots(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged roots: %w", err)
	}

	// Proof fees
	if err := p.DeleteReorgedProofFees(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged proof fees: %w", err)
	}

	// Event logs
	if err := p.DeleteReorgedEventLogs(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged event logs: %w", err)
	}

	// Transactions
	if err := p.DeleteReorgedTransactions(ctx, startHeight, endHeight); err != nil {
		return fmt.Errorf("failed to delete reorged transactions: %w", err)
	}

	return nil
}

// CleanupFinalizedData removes unnecessary historical versions of providers, proof_sets, roots in finalized blocks
func (p *PostgresDB) CleanupFinalizedData(ctx context.Context, currentBlockNumber uint64) error {
	// blocks
	if err := p.CleanupFinalizedBlocks(ctx, currentBlockNumber); err != nil {
		return fmt.Errorf("failed to cleanup finalized blocks: %w", err)
	}

	// providers
	if err := p.CleanupFinalizedProviders(ctx, currentBlockNumber); err != nil {
		return fmt.Errorf("failed to cleanup finalized providers: %w", err)
	}

	// proof sets
	if err := p.CleanupFinalizedProofSets(ctx, currentBlockNumber); err != nil {
		return fmt.Errorf("failed to cleanup finalized proof sets: %w", err)
	}

	// roots
	if err := p.CleanupFinalizedRoots(ctx, currentBlockNumber); err != nil {
		return fmt.Errorf("failed to cleanup finalized roots: %w", err)
	}
	
	return nil
}
