-- Drop proof sets table and all dependent objects
DROP INDEX IF EXISTS idx_proof_sets_block_number;
DROP INDEX IF EXISTS idx_proof_sets_set_owner;
DROP INDEX IF EXISTS idx_proof_sets_set_id;
DROP TABLE IF EXISTS proof_sets;