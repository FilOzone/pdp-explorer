CREATE TABLE event_logs (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    address TEXT NOT NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    log_index BIGINT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT false,
    topics TEXT[] NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Reorg tracking
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES event_logs(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness for latest version of each log
    UNIQUE(set_id, log_index, block_number, is_latest) WHERE is_latest = true
);

-- Indexes
CREATE INDEX idx_event_logs_set_id ON event_logs(set_id) WHERE is_latest;
CREATE INDEX idx_event_logs_address ON event_logs(address) WHERE is_latest;
CREATE INDEX idx_event_logs_name ON event_logs(name) WHERE is_latest;
CREATE INDEX idx_event_logs_block_number ON event_logs(block_number);
CREATE INDEX idx_event_logs_block_hash ON event_logs(block_hash);
CREATE INDEX idx_event_logs_previous_id ON event_logs(previous_id);
CREATE INDEX idx_event_logs_topics ON event_logs USING gin(topics);