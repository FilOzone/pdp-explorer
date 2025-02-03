CREATE TABLE providers (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    total_faulted_periods BIGINT NOT NULL DEFAULT 0,
    total_data_size BIGINT NOT NULL DEFAULT 0,
    proof_set_ids BIGINT[] NOT NULL DEFAULT '{}',
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    previous_id BIGINT REFERENCES providers(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_providers_address ON providers(address);
CREATE INDEX idx_providers_block_number ON providers(block_number);
CREATE INDEX idx_providers_block_hash ON providers(block_hash);
CREATE INDEX idx_providers_previous_id ON providers(previous_id);