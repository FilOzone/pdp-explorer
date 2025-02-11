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
  hash,
  parent_hash,
  EXTRACT(EPOCH FROM timestamp)::bigint,
  is_processed
FROM (
  SELECT
    generate_series(1000, 1006) as height,
    'hash_' || generate_series(1000, 1006) as hash,
    'parent_' || generate_series(999, 1005) as parent_hash,
    NOW() - ((6 - generate_series(0, 6)) || ' days')::interval as timestamp,
    true as is_processed
) as subquery;

-- Insert providers with realistic data sizes
INSERT INTO providers (address, total_faulted_periods, total_data_size, block_number, block_hash)
VALUES
  ('f01234', 3, 2199023255552, 1000, 'hash_1000'),    -- 2 TB
  ('f05678', 1, 1099511627776, 1000, 'hash_1000'),    -- 1 TB
  ('f09876', 0, 3298534883328, 1000, 'hash_1000'),    -- 3 TB
  ('f02468', 2, 549755813888, 1000, 'hash_1000'),     -- 512 GB
  ('f013579', 4, 4398046511104, 1000, 'hash_1000');   -- 4 TB

-- Insert proof sets with varied states and realistic timestamps
INSERT INTO proof_sets (set_id, owner, listener_addr, total_data_size, total_roots, is_active, created_at, updated_at, block_number, block_hash)
VALUES
  -- f01234's proof sets
  (1, 'f01234', 'f09999', 1099511627776, 2000, true, NOW() - INTERVAL '90 days', NOW() - INTERVAL '1 day', 1001, 'hash_1001'),
  (2, 'f01234', 'f09999', 549755813888, 1000, true, NOW() - INTERVAL '60 days', NOW() - INTERVAL '2 days', 1001, 'hash_1001'),
  (3, 'f01234', 'f09999', 549755813888, 800, false, NOW() - INTERVAL '120 days', NOW() - INTERVAL '30 days', 1001, 'hash_1001'),
  
  -- f05678's proof sets
  (4, 'f05678', 'f08888', 549755813888, 1500, true, NOW() - INTERVAL '45 days', NOW(), 1001, 'hash_1001'),
  (5, 'f05678', 'f08888', 549755813888, 1200, true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', 1001, 'hash_1001'),
  
  -- f09876's proof sets
  (6, 'f09876', 'f07777', 1649267441664, 3000, true, NOW() - INTERVAL '75 days', NOW(), 1001, 'hash_1001'),
  (7, 'f09876', 'f07777', 1649267441664, 2800, true, NOW() - INTERVAL '60 days', NOW() - INTERVAL '1 day', 1001, 'hash_1001'),
  
  -- f02468's proof sets
  (8, 'f02468', 'f06666', 274877906944, 500, true, NOW() - INTERVAL '30 days', NOW(), 1001, 'hash_1001'),
  (9, 'f02468', 'f06666', 274877906944, 450, false, NOW() - INTERVAL '90 days', NOW() - INTERVAL '15 days', 1001, 'hash_1001'),
  
  -- f013579's proof sets
  (10, 'f013579', 'f05555', 2199023255552, 4000, true, NOW() - INTERVAL '120 days', NOW(), 1001, 'hash_1001'),
  (11, 'f013579', 'f05555', 2199023255552, 3800, true, NOW() - INTERVAL '90 days', NOW() - INTERVAL '1 day', 1001, 'hash_1001');

-- Insert transactions with varied methods and realistic timestamps
INSERT INTO transactions (hash, proof_set_id, message_id, height, from_address, to_address, value, method, status, block_number, block_hash)
SELECT 
  'tx_' || set_id || '_' || generate_series as hash,
  set_id,
  'msg_' || set_id || '_' || generate_series as message_id,
  1001 + (random() * 5)::int as height,
  owner as from_address,
  listener_addr as to_address,
  (random() * 1000000)::int as value,
  CASE (random() * 2)::int
    WHEN 0 THEN 'SubmitProof'
    WHEN 1 THEN 'FaultReport'
    ELSE 'SubmitProof'
  END as method,
  CASE (random() * 10)::int
    WHEN 0 THEN false
    ELSE true
  END as status,
  1001 as block_number,
  'hash_1001' as block_hash
FROM 
  proof_sets,
  generate_series(1, 50)
WHERE is_active = true;

-- Insert proof fees with realistic values and timestamps
INSERT INTO proof_fees (fee_id, set_id, proof_fee, fil_usd_price, fil_usd_price_exponent, created_at, block_number, block_hash)
SELECT 
  'fee_' || (row_number() over ())::text as fee_id,
  set_id,
  (random() * 500000 + 500000)::int as proof_fee,
  (random() * 1000000 + 4500000)::int as fil_usd_price,
  6 as fil_usd_price_exponent,
  created_at + ((random() * 60) || ' days')::interval as created_at,
  1001 as block_number,
  'hash_1001' as block_hash
FROM (
  SELECT set_id, created_at 
  FROM proof_sets 
  WHERE is_active = true
) active_sets,
generate_series(1, 20);

-- Insert proofs for heatmap with varied success rates
INSERT INTO proofs (set_id, root_id, proof_offset, leaf_hash, merkle_proof, proven_at, block_number, block_hash)
SELECT 
  set_id,
  (random() * 10)::int as root_id,
  (random() * 100)::int as proof_offset,
  E'\\x01' as leaf_hash,
  E'\\x01' as merkle_proof,
  NOW() - ((random() * 7) || ' days')::interval as proven_at,
  1001 as block_number,
  'hash_1001' as block_hash
FROM (
  SELECT set_id FROM proof_sets WHERE is_active = true
) active_sets,
generate_series(1, 50);

-- Insert fault records with realistic patterns
INSERT INTO fault_records (set_id, challenge_epoch, periods_faulted, deadline, created_at, block_number, block_hash)
SELECT 
  set_id,
  1000 + (row_number() over ())::int as challenge_epoch,
  (random() * 3 + 1)::int as periods_faulted,
  2000 + (row_number() over ())::int as deadline,
  created_at + ((random() * 60) || ' days')::interval as created_at,
  1001 as block_number,
  'hash_1001' as block_hash
FROM (
  SELECT set_id, created_at 
  FROM proof_sets 
  WHERE random() < 0.3  -- Only 30% of proof sets have faults
) faulted_sets;

-- Insert roots with realistic sizes
INSERT INTO roots (set_id, root_id, raw_size, cid, block_number, block_hash)
SELECT 
  set_id,
  generate_series as root_id,
  CASE (random() * 2)::int
    WHEN 0 THEN 34359738368  -- 32 GB
    WHEN 1 THEN 68719476736  -- 64 GB
    ELSE 17179869184        -- 16 GB
  END as raw_size,
  'bafy' || set_id || '_' || generate_series as cid,
  1001 as block_number,
  'hash_1001' as block_hash
FROM 
  proof_sets,
  generate_series(1, 5)
WHERE is_active = true;

COMMIT; 