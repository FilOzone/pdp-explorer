CREATE TABLE proof_sets (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    set_owner TEXT NOT NULL,
    listener_addr TEXT NOT NULL,
    total_faults BIGINT NOT NULL DEFAULT 0,
    total_data_size BIGINT NOT NULL DEFAULT 0,
    total_roots BIGINT NOT NULL DEFAULT 0,
    total_proved_roots BIGINT NOT NULL DEFAULT 0,
    last_proven_epoch BIGINT DEFAULT 0,
    next_challenge_epoch BIGINT DEFAULT 0,
    last_proof_received TIMESTAMP WITH TIME ZONE,
    next_proof_expected TIMESTAMP WITH TIME ZONE,
    total_transactions BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES proof_sets(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness for latest version of each set_id
    UNIQUE(set_id, is_latest) WHERE is_latest = true
);

-- Indexes
CREATE INDEX idx_proof_sets_set_id ON proof_sets(set_id);
CREATE INDEX idx_proof_sets_set_owner ON proof_sets(set_owner) WHERE is_latest;
CREATE INDEX idx_proof_sets_block_number ON proof_sets(block_number);
CREATE INDEX idx_proof_sets_block_hash ON proof_sets(block_hash);
CREATE INDEX idx_proof_sets_previous_id ON proof_sets(previous_id);