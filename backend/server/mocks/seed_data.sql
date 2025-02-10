-- Seed data for PDP Explorer

BEGIN;

-- Clear existing data (for idempotency)
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

-- Insert blocks
INSERT INTO blocks (height, hash, parent_hash, timestamp, is_processed)
VALUES
  (1000, '0xabc1', '0xabc0', 1717200000, true),
  (1001, '0xabc2', '0xabc1', 1717203600, true),
  (1002, '0xabc3', '0xabc2', 1717207200, true);

-- Insert providers
INSERT INTO providers (address, total_faulted_periods, total_data_size, block_number, block_hash)
VALUES
  ('f01234', 2, 1024000000000, 1000, '0xabc1'),
  ('f05678', 0, 512000000000, 1000, '0xabc1');

-- Insert proof sets (both active and inactive)
INSERT INTO proof_sets (set_id, owner, listener_addr, total_data_size, total_roots, is_active, block_number, block_hash)
VALUES
  (1, 'f01234', 'f09999', 512000000000, 1500, true, 1001, '0xabc2'),
  (2, 'f01234', 'f09999', 512000000000, 800, false, 1001, '0xabc2'),
  (3, 'f05678', 'f08888', 512000000000, 2000, true, 1001, '0xabc2');

-- Insert roots
INSERT INTO roots (set_id, root_id, raw_size, cid, block_number, block_hash)
VALUES
  (1, 1, 34359738368, 'bafy1', 1001, '0xabc2'),
  (1, 2, 34359738368, 'bafy2', 1001, '0xabc2'),
  (3, 1, 68719476736, 'bafy3', 1001, '0xabc2');

-- Insert transactions
INSERT INTO transactions (hash, proof_set_id, message_id, height, from_address, to_address, value, method, status, block_number, block_hash)
VALUES
  ('0xtx1', 1, 'msg1', 1001, 'f01234', 'f09999', 1000000, 'SubmitProof', true, 1001, '0xabc2'),
  ('0xtx2', 1, 'msg2', 1001, 'f01234', 'f09999', 0, 'FaultReport', false, 1001, '0xabc2'),
  ('0xtx3', 3, 'msg3', 1001, 'f05678', 'f08888', 500000, 'SubmitProof', true, 1001, '0xabc2');

-- Insert proof fees
INSERT INTO proof_fees (fee_id, set_id, proof_fee, fil_usd_price, fil_usd_price_exponent, block_number, block_hash)
VALUES
  ('fee1', 1, 1000000, 5000000, 6, 1001, '0xabc2'),
  ('fee2', 3, 500000, 5000000, 6, 1001, '0xabc2');

-- Insert proofs (last 7 days data for heatmap)
INSERT INTO proofs (set_id, root_id, proof_offset, leaf_hash, merkle_proof, proven_at, block_number, block_hash)
VALUES
  (1, 1, 0, E'\\x01', E'\\x01', NOW() - INTERVAL '1 day', 1001, '0xabc2'),
  (1, 1, 1, E'\\x02', E'\\x02', NOW() - INTERVAL '2 days', 1001, '0xabc2'),
  (3, 1, 0, E'\\x03', E'\\x03', NOW() - INTERVAL '3 days', 1001, '0xabc2');

-- Insert fault records
INSERT INTO fault_records (set_id, challenge_epoch, periods_faulted, deadline, block_number, block_hash)
VALUES
  (1, 1000, 2, 1005, 1001, '0xabc2'),
  (1, 1005, 1, 1010, 1001, '0xabc2');

COMMIT; 