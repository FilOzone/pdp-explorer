-- Seed data for PDP Explorer

BEGIN;

-- Clear existing data
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

-- Insert blocks for the last 7 days
INSERT INTO blocks (height, hash, parent_hash, timestamp, is_processed)
SELECT 
  height,
  'hash_' || height as hash,
  'parent_' || (height - 1) as parent_hash,
  EXTRACT(EPOCH FROM timestamp)::bigint,
  true as is_processed
FROM (
  SELECT
    generate_series(1000, 1006) as height,
    NOW() - ((6 - generate_series(0, 6)) || ' days')::interval as timestamp
) as subquery;

-- Insert providers with realistic Filecoin addresses and data sizes
INSERT INTO providers (address, total_faulted_periods, total_data_size, proof_set_ids, block_number, block_hash)
VALUES
  ('f0421499', 2, '2199023255552', '{1,2}', 1000, 'hash_1000'),    -- 2 TB
  ('f0421500', 0, '1099511627776', '{3,4}', 1000, 'hash_1000'),    -- 1 TB
  ('f0421501', 1, '3298534883328', '{5,6}', 1000, 'hash_1000'),    -- 3 TB
  ('f0421502', 3, '549755813888', '{7,8}', 1000, 'hash_1000'),     -- 512 GB
  ('f0421503', 1, '4398046511104', '{9,10}', 1000, 'hash_1000');   -- 4 TB

-- Insert proof sets with realistic values
INSERT INTO proof_sets (
  set_id, owner, listener_addr, total_faulted_periods, total_data_size, 
  total_roots, total_proved_roots, total_fee_paid, last_proven_epoch, 
  next_challenge_epoch, is_active, block_number, block_hash
)
VALUES
  (1, 'f0421499', 'f01234', 1, '1099511627776', 2000, 1800, '1000000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (2, 'f0421499', 'f01234', 1, '1099511627776', 1800, 1600, '900000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (3, 'f0421500', 'f01235', 0, '549755813888', 1000, 950, '500000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (4, 'f0421500', 'f01235', 0, '549755813888', 1200, 1150, '600000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (5, 'f0421501', 'f01236', 1, '1649267441664', 3000, 2900, '1500000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (6, 'f0421501', 'f01236', 0, '1649267441664', 2800, 2700, '1400000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (7, 'f0421502', 'f01237', 2, '274877906944', 500, 450, '250000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (8, 'f0421502', 'f01237', 1, '274877906944', 450, 400, '225000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (9, 'f0421503', 'f01238', 1, '2199023255552', 4000, 3800, '2000000000000000000', 100000, 100100, true, 1001, 'hash_1001'),
  (10, 'f0421503', 'f01238', 0, '2199023255552', 3800, 3600, '1900000000000000000', 100000, 100100, true, 1001, 'hash_1001');

-- Insert transactions with realistic Filecoin values
INSERT INTO transactions (
  hash, proof_set_id, message_id, height, from_address, to_address, 
  value, method, status, block_number, block_hash
)
SELECT 
  'bafy2bzaced' || set_id || generate_series as hash,
  set_id,
  'msg_' || set_id || '_' || generate_series as message_id,
  1001 + (random() * 5)::int as height,
  owner as from_address,
  listener_addr as to_address,
  (random() * 1000000000000000000)::text as value,
  CASE (random() * 3)::int
    WHEN 0 THEN 'SubmitProof'
    WHEN 1 THEN 'AddRoot'
    ELSE 'RemoveRoot'
  END as method,
  random() > 0.1 as status,
  1001 as block_number,
  'hash_1001' as block_hash
FROM 
  proof_sets,
  generate_series(1, 20)
WHERE is_active = true;

-- Insert realistic proof fees
INSERT INTO proof_fees (
  fee_id, set_id, proof_fee, fil_usd_price, fil_usd_price_exponent,
  block_number, block_hash
)
SELECT 
  'fee_' || set_id || '_' || generate_series as fee_id,
  set_id,
  (random() * 1000000000000000)::bigint as proof_fee,
  4500000 as fil_usd_price, -- $4.50 FIL price
  6 as fil_usd_price_exponent,
  1001 as block_number,
  'hash_1001' as block_hash
FROM 
  proof_sets,
  generate_series(1, 10)
WHERE is_active = true;

-- Insert fault records with realistic epochs
INSERT INTO fault_records (
  set_id, challenge_epoch, periods_faulted, deadline,
  block_number, block_hash
)
SELECT 
  set_id,
  100000 + (row_number() over ())::bigint as challenge_epoch,
  (random() * 2 + 1)::bigint as periods_faulted,
  100100 + (row_number() over ())::bigint as deadline,
  1001 as block_number,
  'hash_1001' as block_hash
FROM (
  SELECT set_id FROM proof_sets WHERE random() < 0.3
) faulted_sets;

-- Insert roots with realistic CIDs and sizes
INSERT INTO roots (
  set_id, root_id, raw_size, cid, removed,
  block_number, block_hash
)
SELECT 
  set_id,
  generate_series as root_id,
  CASE (random() * 2)::int
    WHEN 0 THEN 34359738368  -- 32 GB
    WHEN 1 THEN 68719476736  -- 64 GB
    ELSE 17179869184        -- 16 GB
  END as raw_size,
  'bafybeig' || set_id || generate_series || 'z' as cid,
  false as removed,
  1001 as block_number,
  'hash_1001' as block_hash
FROM 
  proof_sets,
  generate_series(1, 5)
WHERE is_active = true;

COMMIT; 