CREATE TABLE roots (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    root_id BIGINT NOT NULL,
    raw_size BIGINT NOT NULL,
    cid TEXT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT false,
    total_proofs BIGINT NOT NULL DEFAULT 0,
    total_faults BIGINT NOT NULL DEFAULT 0, -- isn't been used yet
    last_proven_epoch BIGINT DEFAULT 0,
    last_faulted_epoch BIGINT DEFAULT 0, -- isn't been used yet
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraints
    UNIQUE (set_id, root_id, block_number)
);

-- Indexes
CREATE INDEX idx_roots_set_id ON roots(set_id);
CREATE INDEX idx_roots_cid ON roots(cid);
CREATE INDEX idx_roots_block_number ON roots(block_number);
CREATE INDEX idx_roots_previous_id ON roots(previous_id);