package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/models"
)

// StoreProof stores a new proof in the database
func (p *PostgresDB) StoreFaultRecords(ctx context.Context, record *models.FaultRecord) error {
	// Insert the new version
	_, err := p.pool.Exec(ctx, `
		INSERT INTO fault_records (
			set_id, challenge_epoch, periods_faulted, deadline,
			block_number, block_hash,
			created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7
		)
	`, record.SetId, record.ChallengeEpoch, record.PeriodsFaulted, record.Deadline,
		record.BlockNumber, record.BlockHash, record.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert fault record: %w", err)
	}
	return nil
}

// DeleteReorgedProofs removes fault records from reorged blocks
func (p *PostgresDB) DeleteReorgedFaultRecords(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM fault_records 
        WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)

	if err != nil {
		return fmt.Errorf("failed to delete reorged fault records: %w", err)
	}
	return nil
}
