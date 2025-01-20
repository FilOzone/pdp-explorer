package database

import (
	"context"
	"encoding/json"
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

// StoreProofSet stores a new proof set
func (p *PostgresDB) StoreProofSet(ctx context.Context, proofSet *processor.ProofSet) error {
	query := `
		INSERT INTO proof_sets (set_id, status, created_at, tx_hash, first_root, num_roots)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (set_id) DO UPDATE SET
			status = EXCLUDED.status,
			tx_hash = EXCLUDED.tx_hash,
			first_root = EXCLUDED.first_root,
			num_roots = EXCLUDED.num_roots
	`

	_, err := p.ExecContext(ctx, query,
		proofSet.SetID,
		proofSet.Status,
		proofSet.CreatedAt,
		proofSet.TxHash,
		proofSet.FirstRoot.String(),
		proofSet.NumRoots,
	)
	if err != nil {
		return fmt.Errorf("failed to store proof set: %w", err)
	}

	return nil
}

// UpdateProofSet updates an existing proof set
func (p *PostgresDB) UpdateProofSet(ctx context.Context, setID string, updates map[string]interface{}) error {
	// Convert updates to JSON for logging
	updateJSON, _ := json.Marshal(updates)
	
	// Build dynamic query
	query := "UPDATE proof_sets SET "
	vals := []interface{}{setID}
	paramCount := 1

	for key, value := range updates {
		if paramCount > 1 {
			query += ", "
		}
		query += fmt.Sprintf("%s = $%d", key, paramCount+1)
		vals = append(vals, value)
		paramCount++
	}
	query += " WHERE set_id = $1"

	result, err := p.ExecContext(ctx, query, vals...)
	if err != nil {
		return fmt.Errorf("failed to update proof set %s with updates %s: %w", setID, updateJSON, err)
	}

	rows := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("no proof set found with ID %s", setID)
	}

	return nil
}

// StoreProofFee stores a proof fee record
func (p *PostgresDB) StoreProofFee(ctx context.Context, fee *processor.ProofFee) error {
	query := `
		INSERT INTO proof_fees (set_id, fee, price, exponent, tx_hash, block_number)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := p.ExecContext(ctx, query,
		fee.SetID,
		fee.Fee.String(),
		fee.Price,
		fee.Exponent,
		fee.TxHash,
		fee.BlockNumber,
	)
	if err != nil {
		return fmt.Errorf("failed to store proof fee: %w", err)
	}

	return nil
}

// StoreFaultRecord stores a fault record
func (p *PostgresDB) StoreFaultRecord(ctx context.Context, record *processor.FaultRecord) error {
	query := `
		INSERT INTO fault_records (proof_set_id, periods_faulted, deadline, tx_hash, block_number)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := p.ExecContext(ctx, query,
		record.ProofSetID,
		record.PeriodsFaulted.String(),
		record.Deadline.String(),
		record.TxHash,
		record.BlockNumber,
	)
	if err != nil {
		return fmt.Errorf("failed to store fault record: %w", err)
	}

	return nil
}

// StoreTransfer stores a WFIL transfer record
func (p *PostgresDB) StoreTransfer(ctx context.Context, transfer *processor.Transfer) error {
	query := `
		INSERT INTO transfers (from_address, to_address, amount, tx_hash, block_number, log_index)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := p.ExecContext(ctx, query,
		transfer.FromAddress,
		transfer.ToAddress,
		transfer.Amount.String(),
		transfer.TxHash,
		transfer.BlockNumber,
		transfer.LogIndex,
	)
	if err != nil {
		return fmt.Errorf("failed to store transfer: %w", err)
	}

	return nil
}

type SyncState struct {
    ID              int64     `db:"id"`
    LastSyncedBlock int64     `db:"last_synced_block"`
    LastSyncTime    time.Time `db:"last_sync_time"`
    Status          string    `db:"status"`
    CreatedAt       time.Time `db:"created_at"`
    UpdatedAt       time.Time `db:"updated_at"`
}

// GetLastSyncedBlock returns the last successfully synced block number
func (db *PostgresDB) GetLastSyncedBlock(ctx context.Context) (int64, error) {
    var state SyncState
    err := db.pool.QueryRow(ctx, `
        SELECT * FROM sync_state 
        ORDER BY last_synced_block DESC 
        LIMIT 1
    `).Scan(&state.ID, &state.LastSyncedBlock, &state.LastSyncTime, &state.Status, &state.CreatedAt, &state.UpdatedAt)
    if err == pgx.ErrNoRows {
        return 0, nil
    }
    if err != nil {
        return 0, fmt.Errorf("failed to get last synced block: %w", err)
    }
    return state.LastSyncedBlock, nil
}

// UpdateSyncState updates the sync state with the latest block number
func (db *PostgresDB) UpdateSyncState(ctx context.Context, blockNumber int64, status string) error {
    _, err := db.ExecContext(ctx, `
        INSERT INTO sync_state (last_synced_block, last_sync_time, status)
        VALUES ($1, NOW(), $2)
    `, blockNumber, status)
    if err != nil {
        return fmt.Errorf("failed to update sync state: %w", err)
    }
    return nil
}

type Block struct {
    Height     uint64    `db:"height"`
    Hash       string    `db:"hash"`
    ParentHash string    `db:"parent_hash"`
    Timestamp  uint64    `db:"timestamp"`
    CreatedAt  time.Time `db:"created_at"`
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
        INSERT INTO blocks (height, hash, parent_hash, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (height) DO UPDATE
        SET hash = EXCLUDED.hash,
            parent_hash = EXCLUDED.parent_hash,
            timestamp = EXCLUDED.timestamp
    `, block.Height, block.Hash, block.ParentHash, block.Timestamp)
    
    if err != nil {
        return fmt.Errorf("failed to save block: %w", err)
    }
    return nil
}

// DeleteBlocksFrom deletes all blocks from the given height onwards
func (db *PostgresDB) DeleteBlocksFrom(ctx context.Context, height uint64) error {
    _, err := db.pool.Exec(ctx, `
        DELETE FROM blocks 
        WHERE height >= $1
    `, height)
    
    if err != nil {
        return fmt.Errorf("failed to delete blocks: %w", err)
    }
    return nil
}

// Reorg blocks
func (db *PostgresDB) MoveToReorgedBlocks(ctx context.Context, startHeight, endHeight uint64) error {
    tx, err := db.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("failed to start transaction: %w", err)
    }
    defer tx.Rollback(ctx)

    // Move blocks to reorged_blocks table
    _, err = tx.Exec(ctx, `
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
    _, err = tx.Exec(ctx, `
        DELETE FROM blocks
        WHERE height BETWEEN $1 AND $2
    `, startHeight, endHeight)
    if err != nil {
        return fmt.Errorf("failed to delete reorged blocks: %w", err)
    }

    return tx.Commit(ctx)
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
