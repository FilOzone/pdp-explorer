CREATE TABLE IF NOT EXISTS transfers (
    id SERIAL PRIMARY KEY,
    from_address VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    amount NUMERIC NOT NULL,
    tx_hash VARCHAR NOT NULL,
    block_number BIGINT NOT NULL,
    log_index VARCHAR NOT NULL,
    created_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transfers_from_address ON transfers(from_address);
CREATE INDEX idx_transfers_to_address ON transfers(to_address);
CREATE INDEX idx_transfers_block_number ON transfers(block_number);
CREATE INDEX idx_transfers_tx_hash ON transfers(tx_hash);
