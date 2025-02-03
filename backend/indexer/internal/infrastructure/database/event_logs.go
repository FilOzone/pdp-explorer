package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/processor"
)

// StoreEventLog stores a new event log in the database
func (db *PostgresDB) StoreEventLog(ctx context.Context, eventLog *processor.EventLog) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO event_logs (
			set_id,
			address,
			name,
			data,
			log_index,
			removed,
			topics,
			block_number,
			block_hash,
			transaction_hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (transaction_hash, log_index) DO UPDATE SET
			set_id = EXCLUDED.set_id,
			address = EXCLUDED.address,
			name = EXCLUDED.name,
			data = EXCLUDED.data,
			removed = EXCLUDED.removed,
			topics = EXCLUDED.topics,
			block_number = EXCLUDED.block_number,
			block_hash = EXCLUDED.block_hash`,
		eventLog.SetId,
		eventLog.Address,
		eventLog.Name,
		eventLog.Data,
		eventLog.LogIndex,
		eventLog.Removed,
		eventLog.Topics,
		eventLog.BlockNumber,
		eventLog.BlockHash,
		eventLog.TransactionHash)

	if err != nil {
		return fmt.Errorf("failed to store event log: %w", err)
	}

	return nil
}

// DeleteReorgedEventLogs removes event logs from reorged blocks
func (db *PostgresDB) DeleteReorgedEventLogs(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := db.pool.Exec(ctx, `
		DELETE FROM event_logs 
		WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)

	if err != nil {
		return fmt.Errorf("failed to delete reorged event logs: %w", err)
	}
	return nil
}
