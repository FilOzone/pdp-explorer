CREATE TABLE proof_sets (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    owner TEXT NOT NULL,
    listener_addr TEXT NOT NULL,
    total_faulted_periods BIGINT NOT NULL DEFAULT 0,
    total_data_size BIGINT NOT NULL DEFAULT 0,
    total_roots BIGINT NOT NULL DEFAULT 0,
    total_proved_roots BIGINT NOT NULL DEFAULT 0,
    total_fee_paid BIGINT NOT NULL DEFAULT 0,
    last_proven_epoch BIGINT DEFAULT 0,
    next_challenge_epoch BIGINT DEFAULT 0,
    total_transactions BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    previous_id BIGINT REFERENCES proof_sets(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_proof_sets_set_id ON proof_sets(set_id);
CREATE INDEX idx_proof_sets_set_owner ON proof_sets(owner);
CREATE INDEX idx_proof_sets_block_number ON proof_sets(block_number);
CREATE INDEX idx_proof_sets_block_hash ON proof_sets(block_hash);
CREATE INDEX idx_proof_sets_previous_id ON proof_sets(previous_id);