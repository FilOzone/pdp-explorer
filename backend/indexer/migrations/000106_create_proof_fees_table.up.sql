CREATE TABLE proof_fees (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    proof_fee BIGINT NOT NULL,
    fil_usd_price BIGINT NOT NULL,
    fil_usd_price_exponent BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES proof_fees(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness for latest version of each log
    UNIQUE(set_id, log_index, block_number, is_latest) WHERE is_latest = true
);

-- Indexes
CREATE INDEX idx_proof_fees_set_id ON proof_fees(set_id) WHERE is_latest;
CREATE INDEX idx_proof_fees_block_number ON proof_fees(block_number);
CREATE INDEX idx_proof_fees_block_hash ON proof_fees(block_hash);
CREATE INDEX idx_proof_fees_previous_id ON proof_fees(previous_id);