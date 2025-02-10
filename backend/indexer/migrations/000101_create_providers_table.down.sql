-- Drop the providers table and all dependent objects
DROP INDEX IF EXISTS idx_providers_block_number;
DROP INDEX IF EXISTS idx_providers_address;
DROP TABLE IF EXISTS providers;