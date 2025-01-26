-- Create transfers table to track WFIL token transfers with reorg support
CREATE TABLE transfers (
    -- Primary identifier
    id BIGSERIAL PRIMARY KEY,
    
    -- Transfer details
    from_address VARCHAR NOT NULL,
    to_address VARCHAR, -- Nullable for contract creation
    amount NUMERIC NOT NULL CHECK (amount >= 0), -- Ensure non-negative amounts
    
    -- Blockchain reference
    tx_hash VARCHAR NOT NULL,
    block_number BIGINT NOT NULL CHECK (block_number >= 0),
    block_hash VARCHAR NOT NULL,
    log_index VARCHAR NOT NULL,
    
    -- Version control for reorg handling
    is_latest BOOLEAN NOT NULL DEFAULT true,
    previous_id BIGINT REFERENCES transfers(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
-- Address lookups
CREATE INDEX idx_transfers_from_address ON transfers(from_address);
CREATE INDEX idx_transfers_to_address ON transfers(to_address);

-- Block navigation and reorg handling
CREATE INDEX idx_transfers_block_number ON transfers(block_number);
CREATE INDEX idx_transfers_block_hash ON transfers(block_hash);

-- Transaction lookups
CREATE INDEX idx_transfers_tx_hash ON transfers(tx_hash);

-- Version control lookups
CREATE INDEX idx_transfers_previous_id ON transfers(previous_id);
CREATE INDEX idx_transfers_is_latest ON transfers(is_latest);

-- Composite index for common version queries
CREATE INDEX idx_transfers_version_lookup ON transfers(tx_hash, log_index, is_latest);

-- Helper function for determining block finalization
-- A block is considered finalized after 900 confirmations in Filecoin
CREATE OR REPLACE FUNCTION is_block_finalized(block_number BIGINT, current_block BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Ensure inputs are valid
    IF block_number IS NULL OR current_block IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if block has required confirmations
    RETURN (current_block - block_number) >= 900;
END;
$$ LANGUAGE plpgsql;
