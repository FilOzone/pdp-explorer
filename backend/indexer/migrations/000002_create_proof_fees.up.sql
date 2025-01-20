CREATE TABLE IF NOT EXISTS proof_fees (
    id SERIAL PRIMARY KEY,
    set_id VARCHAR NOT NULL REFERENCES proof_sets(set_id),
    fee NUMERIC NOT NULL,
    price BIGINT NOT NULL,
    exponent INTEGER NOT NULL,
    tx_hash VARCHAR NOT NULL,
    block_number BIGINT NOT NULL,
    created_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proof_fees_set_id ON proof_fees(set_id);
CREATE INDEX idx_proof_fees_block_number ON proof_fees(block_number);
