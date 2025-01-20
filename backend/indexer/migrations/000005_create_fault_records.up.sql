CREATE TABLE IF NOT EXISTS fault_records (
    id SERIAL PRIMARY KEY,
    proof_set_id VARCHAR NOT NULL REFERENCES proof_sets(set_id),
    periods_faulted NUMERIC NOT NULL,
    deadline NUMERIC NOT NULL,
    tx_hash VARCHAR NOT NULL,
    block_number BIGINT NOT NULL,
    created_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fault_records_proof_set_id ON fault_records(proof_set_id);
CREATE INDEX idx_fault_records_block_number ON fault_records(block_number);
