CREATE TABLE transactions (
    hash TEXT NOT NULL PRIMARY KEY,
    proof_set_id BIGINT NOT NULL,
    message_id TEXT NOT NULL,
    height BIGINT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value TEXT NOT NULL,
    method TEXT NOT NULL,
    status BOOLEAN NOT NULL, -- true for success, false for failure
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_proof_set_id ON transactions(proof_set_id);
CREATE INDEX idx_transactions_from_address ON transactions(from_address);
CREATE INDEX idx_transactions_to_address ON transactions(to_address);
CREATE INDEX idx_transactions_block_number ON transactions(block_number);