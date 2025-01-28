CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    proof_set_id BIGINT NOT NULL,
    message_id TEXT NOT NULL,
    height BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value BIGINT NOT NULL,
    method TEXT NOT NULL,
    status BOOLEAN NOT NULL, -- true for success, false for failure
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness for latest version of each transaction
    UNIQUE(hash, is_latest) WHERE is_latest = true
);

-- Indexes
CREATE INDEX idx_transactions_proof_set_id ON transactions(proof_set_id) WHERE is_latest;
CREATE INDEX idx_transactions_from_address ON transactions(from_address) WHERE is_latest;
CREATE INDEX idx_transactions_to_address ON transactions(to_address) WHERE is_latest;
CREATE INDEX idx_transactions_block_number ON transactions(block_number);
CREATE INDEX idx_transactions_block_hash ON transactions(block_hash);
CREATE INDEX idx_transactions_previous_id ON transactions(previous_id);