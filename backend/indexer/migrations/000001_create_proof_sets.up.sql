CREATE TABLE IF NOT EXISTS proof_sets (
    set_id VARCHAR PRIMARY KEY,
    status VARCHAR NOT NULL,
    created_at BIGINT NOT NULL,
    tx_hash VARCHAR NOT NULL,
    first_root NUMERIC,
    num_roots BIGINT,
    created_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proof_sets_status ON proof_sets(status);
CREATE INDEX idx_proof_sets_created_at ON proof_sets(created_at);

-- Trigger to automatically update updated_at_time
CREATE OR REPLACE FUNCTION update_updated_at_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_proof_sets_updated_at_time
    BEFORE UPDATE ON proof_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_time();
