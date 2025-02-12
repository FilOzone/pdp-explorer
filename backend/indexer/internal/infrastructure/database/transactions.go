package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/models"
)

// StoreTransaction stores a new transaction in the database
func (db *PostgresDB) StoreTransaction(ctx context.Context, tx *models.Transaction) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO transactions (
			hash,
			proof_set_id,
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
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (hash) DO UPDATE SET
			proof_set_id = EXCLUDED.proof_set_id,
			message_id = EXCLUDED.message_id,
			height = EXCLUDED.height,
			from_address = EXCLUDED.from_address,
			to_address = EXCLUDED.to_address,
			value = EXCLUDED.value,
			method = EXCLUDED.method,
			status = EXCLUDED.status,
			block_number = EXCLUDED.block_number,
			block_hash = EXCLUDED.block_hash`,
		tx.Hash,
		tx.ProofSetId,
		tx.MessageId,
		tx.Height,
		tx.FromAddress,
		tx.ToAddress,
		tx.Value,
		tx.Method,
		tx.Status,
		tx.BlockNumber,
		tx.BlockHash,
		tx.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to store transaction: %w", err)
	}

	return nil
}

// DeleteReorgedTransactions removes transactions from reorged blocks
func (db *PostgresDB) DeleteReorgedTransactions(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := db.pool.Exec(ctx, `
		DELETE FROM transactions 
		WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)

	if err != nil {
		return fmt.Errorf("failed to delete reorged transactions: %w", err)
	}
	return nil
}
