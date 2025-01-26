-- Drop helper functions
DROP FUNCTION IF EXISTS is_block_finalized(BIGINT, BIGINT);

-- Drop indexes (not strictly necessary as they'll be dropped with the table)
DROP INDEX IF EXISTS idx_transfers_from_address;
DROP INDEX IF EXISTS idx_transfers_to_address;
DROP INDEX IF EXISTS idx_transfers_block_number;
DROP INDEX IF EXISTS idx_transfers_block_hash;
DROP INDEX IF EXISTS idx_transfers_tx_hash;
DROP INDEX IF EXISTS idx_transfers_previous_id;
DROP INDEX IF EXISTS idx_transfers_is_latest;
DROP INDEX IF EXISTS idx_transfers_version_lookup;

-- Drop the transfers table and all dependent objects
DROP TABLE IF EXISTS transfers CASCADE;
