-- Create fault_records table
CREATE TABLE IF NOT EXISTS fault_records (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    challenge_epoch BIGINT NOT NULL,
    periods_faulted BIGINT NOT NULL,
    deadline BIGINT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for common query patterns
CREATE INDEX idx_fault_records_set_id ON fault_records(set_id);
CREATE INDEX idx_fault_records_challenge_epoch ON fault_records(challenge_epoch);
CREATE INDEX idx_fault_records_deadline ON fault_records(deadline);
CREATE INDEX idx_fault_records_block_number ON fault_records(block_number);
