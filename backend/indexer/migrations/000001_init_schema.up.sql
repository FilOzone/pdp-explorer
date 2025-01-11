CREATE TABLE IF NOT EXISTS blocks (
    height          BIGINT PRIMARY KEY,
    cid             TEXT NOT NULL,
    timestamp       TIMESTAMP NOT NULL,
    processed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pdp_events (
    id              SERIAL PRIMARY KEY,
    block_height    BIGINT REFERENCES blocks(height),
    event_type      TEXT NOT NULL,
    data            JSONB NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
CREATE INDEX IF NOT EXISTS idx_pdp_events_block_height ON pdp_events(block_height); 