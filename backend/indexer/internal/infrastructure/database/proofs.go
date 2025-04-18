package database

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/models"
)

// StoreProof stores a new proof in the database
func (p *PostgresDB) StoreProof(ctx context.Context, proof *models.Proof) error {
	_, err := p.pool.Exec(ctx, `
		INSERT INTO proofs (
			set_id, root_id, proof_offset, leaf_hash, merkle_proof,
			proven_at, block_number, block_hash,
			created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)
	`, proof.SetId, proof.RootId, proof.ProofOffset, proof.LeafHash,
		proof.MerkleProof, proof.ProvenAt, proof.BlockNumber,
		proof.BlockHash, proof.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert proof: %w", err)
	}

	return nil
}

// DeleteReorgedProofs removes proofs from reorged blocks
func (p *PostgresDB) DeleteReorgedProofs(ctx context.Context, startHeight, endHeight uint64) error {
	_, err := p.pool.Exec(ctx, `
		DELETE FROM proofs 
        WHERE block_number BETWEEN $1 AND $2`,
		startHeight, endHeight)

	if err != nil {
		return fmt.Errorf("failed to delete reorged proofs: %w", err)
	}
	return nil
}
