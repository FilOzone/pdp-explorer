CREATE TABLE providers (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    total_faulted_periods BIGINT NOT NULL DEFAULT 0,
    total_data_size TEXT NOT NULL,
    proof_set_ids BIGINT[] NOT NULL DEFAULT '{}',
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraints
    UNIQUE (address, block_number)
);

-- Indexes
CREATE INDEX idx_providers_address ON providers(address);
CREATE INDEX idx_providers_block_number ON providers(block_number);