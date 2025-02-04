package database

import (
	"context"
	"fmt"
	"pdp-explorer-indexer/internal/processor"
	"time"
)

// StoreProvider stores or updates a provider record with version control
func (p *PostgresDB) StoreProvider(ctx context.Context, provider *processor.Provider) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)


	// Insert the new version
	_, err = tx.Exec(ctx, `
		INSERT INTO providers (
			address, total_faulted_periods, total_data_size, proof_set_ids,
			block_number, block_hash
		) VALUES (
			$1, $2, $3, $4, $5, $6
		)
	`, provider.Address, provider.TotalFaultedPeriods, provider.TotalDataSize,
		provider.ProofSetIds, provider.BlockNumber, provider.BlockHash)
	if err != nil {
		return fmt.Errorf("failed to insert provider: %w", err)
	}

	return tx.Commit(ctx)
}

// UpdateProvider updates a provider record
func (p *PostgresDB) UpdateProvider(ctx context.Context, provider *processor.Provider) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Insert the new version
	_, err = tx.Exec(ctx, `
		INSERT INTO providers (
			address, total_faulted_periods, total_data_size, proof_set_ids,
			block_number, block_hash, previous_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7
		)
	`, provider.Address, provider.TotalFaultedPeriods, provider.TotalDataSize,
		provider.ProofSetIds, provider.BlockNumber, provider.BlockHash, provider.ID)
	if err != nil {
		return fmt.Errorf("failed to update provider: %w", err)
	}

	return tx.Commit(ctx)
}

// FindProvider finds a provider by address, optionally including historical versions
func (p *PostgresDB) FindProvider(ctx context.Context, address string, includeHistory bool) ([]*processor.Provider, error) {
	query := `
		SELECT id, address, total_faulted_periods, total_data_size, proof_set_ids,
			   block_number, block_hash, previous_id
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

	var providers []*processor.Provider
	for rows.Next() {
		provider := &processor.Provider{}
		err := rows.Scan(
			&provider.ID, &provider.Address, &provider.TotalFaultedPeriods,
			&provider.TotalDataSize, &provider.ProofSetIds,
			&provider.BlockNumber, &provider.BlockHash, &provider.PreviousID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan provider: %w", err)
		}
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
		WITH latest_versions AS (
			SELECT DISTINCT ON (address) id
			FROM providers
			ORDER BY address, block_number DESC
		),
		finalized_duplicates AS (
			SELECT p.id
			FROM providers p
			WHERE p.id NOT IN (SELECT id FROM latest_versions)
				AND is_block_finalized(p.block_number, $1)
				AND EXISTS (
					SELECT 1
					FROM providers newer
					WHERE newer.previous_id = p.id
						AND newer.id IN (SELECT id FROM latest_versions)
						AND is_block_finalized(newer.block_number, $1)
				)
		)
		DELETE FROM providers p
		USING finalized_duplicates fd
		WHERE p.id = fd.id`,
		currentBlockNumber)

	if err != nil {
		return fmt.Errorf("failed to cleanup finalized providers: %w", err)
	}
	return nil
}

// UpdateProviderProofSetIds updates the proof_set_ids array for a provider
func (db *PostgresDB) UpdateProviderProofSetIds(ctx context.Context, address string, addSetIds []int64, removeSetIds []int64, blockNumber uint64, blockHash string) error {
	query := `
		WITH old_version AS (
			WHERE address = $1
			ORDER BY block_number DESC
			LIMIT 1
			RETURNING *
		),
		updated_proof_set_ids AS (
			SELECT 
				ARRAY(
					SELECT DISTINCT unnest(proof_set_ids || $2::bigint[]) AS id 
					FROM old_version 
					WHERE id <> ALL($3::bigint[])
				) AS new_ids
			FROM old_version
		)
		INSERT INTO providers (
			address,
			total_faulted_periods,
			total_data_size,
			proof_set_ids,
			created_at,
			updated_at,
			block_number,
			block_hash
		)
		SELECT
			address,
			total_faulted_periods,
			total_data_size,
			COALESCE((SELECT new_ids FROM updated_proof_set_ids), ARRAY[]::bigint[]),
			created_at,
			NOW(),
			$4, -- block_number
			$5 -- block_hash
		FROM old_version;`

	commandTag, err := db.pool.Exec(ctx, query, address, addSetIds, removeSetIds, blockNumber, blockHash)
	if err != nil {
		return fmt.Errorf("failed to update provider proof set ids: %w", err)
	}

	if commandTag.RowsAffected() == 0 {
		// If provider doesn't exist and we're adding a proof set, create a new provider
		if len(addSetIds) > 0 {
			provider := &processor.Provider{
				ReorgModel: processor.ReorgModel{
					BlockNumber: blockNumber,
					BlockHash:   blockHash,
				},
				Address:             address,
				ProofSetIds:         addSetIds,
				TotalFaultedPeriods: 0,
				TotalDataSize:       0,
			}
			return db.StoreProvider(ctx, provider)
		}
	}

	return nil
}

func (db *PostgresDB) UpdateProviderTotalDataSize(ctx context.Context, address string, totalDataSize int64, method string, createdAt time.Time) error {
	providers, err := db.FindProvider(ctx, address, false)
	if err != nil {
		return fmt.Errorf("failed to find provider: %w", err)
	}

	var provider *processor.Provider
	if len(providers) == 0 {
		return nil
	} else {
		provider = providers[0]
	}

	switch method {
	case "add":
		provider.TotalDataSize += totalDataSize
	case "subtract":
		if provider.TotalDataSize >= totalDataSize {
			provider.TotalDataSize -= totalDataSize
		} else {
			provider.TotalDataSize = 0
		}
	default:
		return fmt.Errorf("unknown method: %s", method)
	}
	provider.UpdatedAt = createdAt

	if err := db.UpdateProvider(ctx, provider); err != nil {
		return fmt.Errorf("failed to update provider: %w", err)
	}

	return nil
}