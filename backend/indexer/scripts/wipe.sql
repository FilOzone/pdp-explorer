-- Reset script for PDP Explorer database
-- This will completely wipe all data while preserving the schema structure

BEGIN;

-- Clear existing data from all tables
TRUNCATE TABLE 
  blocks, 
  providers, 
  proof_sets, 
  transactions, 
  event_logs, 
  roots, 
  proof_fees, 
  proofs, 
  fault_records 
RESTART IDENTITY CASCADE;

COMMIT;
