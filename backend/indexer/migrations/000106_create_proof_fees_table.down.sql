-- Drop proof_fees table and all dependent objects
DROP INDEX IF EXISTS idx_proof_fees_previous_id;
DROP INDEX IF EXISTS idx_proof_fees_block_hash;
DROP INDEX IF EXISTS idx_proof_fees_block_number;
DROP INDEX IF EXISTS idx_proof_fees_set_id;
DROP TABLE IF EXISTS proof_fees;