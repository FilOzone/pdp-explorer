-- Drop script for PDP Explorer database
-- This will completely remove all tables from the database

BEGIN;

-- Drop all tables and their dependencies
DROP TABLE IF EXISTS 
  blocks, 
  providers, 
  proof_sets, 
  transactions, 
  event_logs, 
  roots, 
  proof_fees, 
  proofs, 
  fault_records 
CASCADE;

-- Also drop any functions that might be left
DROP FUNCTION IF EXISTS is_block_finalized;

COMMIT;