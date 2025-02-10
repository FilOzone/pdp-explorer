-- Create a function to check if a block is finalized
CREATE OR REPLACE FUNCTION is_block_finalized(block_number BIGINT, current_block BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Ensure inputs are valid
    IF block_number IS NULL OR current_block IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if block has required confirmations
    RETURN (current_block - block_number) >= 900;
END;
$$ LANGUAGE plpgsql;

