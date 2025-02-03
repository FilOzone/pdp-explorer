CREATE TABLE event_logs (
    set_id BIGINT NOT NULL,
    address TEXT NOT NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    log_index BIGINT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT false,
    topics TEXT[] NOT NULL DEFAULT '{}',
    transaction_hash TEXT NOT NULL,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Primary key using transaction hash and log index
    PRIMARY KEY (transaction_hash, log_index)
);

-- Indexes
CREATE INDEX idx_event_logs_set_id ON event_logs(set_id);
CREATE INDEX idx_event_logs_address ON event_logs(address);
CREATE INDEX idx_event_logs_name ON event_logs(name);
CREATE INDEX idx_event_logs_block_number ON event_logs(block_number);
CREATE INDEX idx_event_logs_block_hash ON event_logs(block_hash);
CREATE INDEX idx_event_logs_topics ON event_logs USING gin(topics);