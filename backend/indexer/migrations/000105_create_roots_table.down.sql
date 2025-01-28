-- Drop roots table and all dependent objects
DROP INDEX IF EXISTS idx_roots_previous_id;
DROP INDEX IF EXISTS idx_roots_block_hash;
DROP INDEX IF EXISTS idx_roots_block_number;
DROP INDEX IF EXISTS idx_roots_cid;
DROP INDEX IF EXISTS idx_roots_set_id;
DROP TABLE IF EXISTS roots;