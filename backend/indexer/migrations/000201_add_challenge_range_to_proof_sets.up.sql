-- Add challengeRange column to proof_sets table
ALTER TABLE proof_sets 
ADD COLUMN challenge_range BIGINT DEFAULT 0;

-- Update existing records to have a default value
UPDATE proof_sets 
SET challenge_range = 0
WHERE challenge_range IS NULL;

-- Add an index for the new column for better query performance
CREATE INDEX idx_proof_sets_challenge_range ON proof_sets(challenge_range);

-- Update the updated_at timestamp for all modified rows
UPDATE proof_sets 
SET updated_at = CURRENT_TIMESTAMP;
