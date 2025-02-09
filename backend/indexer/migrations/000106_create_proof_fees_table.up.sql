CREATE TABLE proof_fees (
    -- Business key components
    fee_id TEXT NOT NULL PRIMARY KEY,
    
    -- Data fields
    set_id BIGINT NOT NULL,
    proof_fee BIGINT NOT NULL,
    fil_usd_price BIGINT NOT NULL,
    fil_usd_price_exponent BIGINT NOT NULL,
    
    -- Block info
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_proof_fees_set_id ON proof_fees(set_id);
CREATE INDEX idx_proof_fees_block_number ON proof_fees(block_number);