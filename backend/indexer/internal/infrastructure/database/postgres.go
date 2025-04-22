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
	pgConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}
	pgConfig.MaxConnLifetime = 30 * time.Minute
	pgConfig.MaxConns = 10
	pgConfig.MinConns = 2
	pgConfig.MaxConnIdleTime = 15 * time.Minute
	pgConfig.ConnConfig.ConnectTimeout = 30 * time.Second
	pgConfig.HealthCheckPeriod = 1 * time.Minute

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

// Transaction methods
type Transaction interface {
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
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
