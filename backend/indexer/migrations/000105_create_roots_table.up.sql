CREATE TABLE roots (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    root_id BIGINT NOT NULL,
    raw_size BIGINT NOT NULL,
    cid TEXT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES roots(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness for latest version of each log
    UNIQUE(set_id, log_index, block_number, is_latest) WHERE is_latest = true
);

-- Indexes
CREATE INDEX idx_roots_set_id ON roots(set_id) WHERE is_latest;
CREATE INDEX idx_roots_cid ON roots(cid) WHERE is_latest;
CREATE INDEX idx_roots_block_number ON roots(block_number);
CREATE INDEX idx_roots_block_hash ON roots(block_hash);
CREATE INDEX idx_roots_previous_id ON roots(previous_id);