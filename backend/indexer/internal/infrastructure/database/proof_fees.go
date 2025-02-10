package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/models"
)

// StoreProofFee stores a new proof fee in the database
func (db *PostgresDB) StoreProofFee(ctx context.Context, proofFee *models.ProofFee) error {
	// Since fee_id is unique (transaction_hash + log_index), we can use INSERT
	// If a duplicate fee_id is found, we can ignore it as it's the same event
	_, err := db.pool.Exec(ctx, `
		INSERT INTO proof_fees (
			fee_id, set_id, proof_fee, fil_usd_price, fil_usd_price_exponent,
			block_number, block_hash, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (fee_id) DO NOTHING`,
		proofFee.FeeId,
		proofFee.SetId,
		proofFee.ProofFee,
		proofFee.FilUsdPrice,
		proofFee.FilUsdPriceExponent,
		proofFee.BlockNumber,
		proofFee.BlockHash,
		proofFee.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to insert proof fee: %w", err)
	}

	return nil
}

// DeleteReorgedProofFees removes proof fees from reorged blocks
func (p *PostgresDB) DeleteReorgedProofFees(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM proof_fees 
        WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)

	if err != nil {
		return fmt.Errorf("failed to delete reorged proof fees: %w", err)
	}
	return nil
}
