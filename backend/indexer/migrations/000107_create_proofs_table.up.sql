-- Create proofs table
CREATE TABLE IF NOT EXISTS proofs (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    root_id BIGINT NOT NULL,
    proof_offset BIGINT NOT NULL,
    leaf_hash BYTEA NOT NULL,
    merkle_proof BYTEA NOT NULL,
    proven_at TIMESTAMP NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for common query patterns
CREATE INDEX idx_proofs_set_id ON proofs(set_id);
CREATE INDEX idx_proofs_root_id ON proofs(root_id);
CREATE INDEX idx_proofs_block_number ON proofs(block_number);

