CREATE TABLE IF NOT EXISTS pdp_proofs (
    id VARCHAR(255) PRIMARY KEY,
    contract_id VARCHAR(255) NOT NULL,
    prover VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    proof_data BYTEA NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for better query performance
    INDEX idx_contract_id (contract_id),
    INDEX idx_prover (prover),
    INDEX idx_block_number (block_number),
    INDEX idx_timestamp (timestamp)
); 