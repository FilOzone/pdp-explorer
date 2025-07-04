package database

import (
	"context"
	"fmt"
	"math/big"

	"pdp-explorer-indexer/internal/models"
)

// StoreProvider stores or updates a provider record with version control
func (p *PostgresDB) StoreProvider(ctx context.Context, provider *models.Provider) error {
	// Insert the new version
	_, err := p.pool.Exec(ctx, `
		INSERT INTO providers (
			address, total_faulted_periods, total_data_size, proof_set_ids,
			block_number, block_hash, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8
		) 
		ON CONFLICT (address, block_number) DO UPDATE SET
			total_faulted_periods = excluded.total_faulted_periods,
			total_data_size = excluded.total_data_size,
			proof_set_ids = excluded.proof_set_ids,
			block_hash = excluded.block_hash,
			updated_at = excluded.updated_at
	`, provider.Address, provider.TotalFaultedPeriods, provider.TotalDataSize,
		provider.ProofSetIds, provider.BlockNumber, provider.BlockHash,
		provider.CreatedAt, provider.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert provider: %w", err)
	}

	return nil
}

// FindProvider finds a provider by address, optionally including historical versions
func (p *PostgresDB) FindProvider(ctx context.Context, address string, includeHistory bool) ([]*models.Provider, error) {
	query := `
		SELECT id, address, total_faulted_periods, total_data_size, proof_set_ids,
			   block_number, block_hash, created_at
		FROM providers
		WHERE address = $1
	`
	query += " ORDER BY block_number DESC"
	if !includeHistory {
		query += " LIMIT 1"
	}

	rows, err := p.pool.Query(ctx, query, address)
	if err != nil {
		return nil, fmt.Errorf("failed to query providers: %w", err)
	}
	defer rows.Close()

	var providers []*models.Provider
	for rows.Next() {
		var totalDataSizeStr string
		provider := &models.Provider{}
		err := rows.Scan(
			&provider.ID, &provider.Address, &provider.TotalFaultedPeriods,
			&totalDataSizeStr, &provider.ProofSetIds,
			&provider.BlockNumber, &provider.BlockHash,
			&provider.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan provider: %w", err)
		}
		var totalDataSize *big.Int
		totalDataSize, ok := new(big.Int).SetString(totalDataSizeStr, 10)
		if !ok {
			return nil, fmt.Errorf("failed to parse total data size: %w", err)
		}
		provider.TotalDataSize = totalDataSize
		providers = append(providers, provider)
	}

	return providers, nil
}

// DeleteReorgedProviders removes providers from reorged blocks
func (p *PostgresDB) DeleteReorgedProviders(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM providers 
		WHERE block_number BETWEEN $1 AND $2
	`, startHeight, endHeight)
	if err != nil {
		return fmt.Errorf("failed to delete reorged providers: %w", err)
	}
	return nil
}

// CleanupFinalizedProviders removes unnecessary historical versions of providers in finalized blocks
func (p *PostgresDB) CleanupFinalizedProviders(ctx context.Context, currentBlockNumber uint64) error {
	_, err := p.pool.Exec(ctx, `
		WITH finalized_latest_versions AS (
			SELECT DISTINCT ON (address) id
			FROM providers
			WHERE is_block_finalized(block_number, $1)
			ORDER BY address, block_number DESC
		),
		finalized_duplicates AS (
			SELECT p.id
			FROM providers p
			WHERE p.id NOT IN (SELECT id FROM finalized_latest_versions)
				AND is_block_finalized(p.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM providers newer
					WHERE newer.id IN (SELECT id FROM finalized_latest_versions)
						AND newer.address = p.address
				)
		)
		DELETE FROM providers
		WHERE id IN (SELECT id FROM finalized_duplicates)`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized providers: %w", err)
	}
	return nil
}
