-- Drop transactions table and all dependent objects
DROP INDEX IF EXISTS idx_transactions_previous_id;
DROP INDEX IF EXISTS idx_transactions_block_hash;
DROP INDEX IF EXISTS idx_transactions_block_number;
DROP INDEX IF EXISTS idx_transactions_to_address;
DROP INDEX IF EXISTS idx_transactions_from_address;
DROP INDEX IF EXISTS idx_transactions_proof_set_id;
DROP TABLE IF EXISTS transactions;