-- Drop the index first
DROP INDEX IF EXISTS idx_proof_sets_challenge_range;

-- Remove the challengeRange column from proof_sets table
ALTER TABLE proof_sets 
DROP COLUMN IF EXISTS challenge_range;
