CREATE TABLE IF NOT EXISTS reorged_blocks (
    id SERIAL PRIMARY KEY,
    height BIGINT NOT NULL,
    hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    reorg_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    original_block_data JSONB
);