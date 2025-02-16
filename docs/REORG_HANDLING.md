# Chain Reorganization (Reorg) Handling

## Overview

Chain reorganization (reorg) occurs when a chain switches to a different fork, causing previously processed blocks to become invalid. The PDP Explorer implements a robust reorg detection and handling mechanism to maintain data consistency with the canonical chain.

## Reorg Detection

The system detects reorgs through the following process:

1. **Parent Hash Verification**
   - For each new block, verify if its parent hash matches the hash of the stored parent block
   - If mismatch detected, initiate reorg detection process

2. **Reorg Depth Calculation**
   - System traverses backwards through blocks until finding a common ancestor (fork point)
   - Maximum reorg depth is limited to 1000 blocks for safety
   - Null epochs are handled gracefully during traversal

## Data Management During Reorg

### Block-Number Based Versioning
The system uses block numbers as version markers for data consistency:

1. **Immutable Records**
   - Each state change is recorded with its corresponding block number
   - Historical records are preserved for audit trails

2. **Update Strategy**
   For tables with updatable data (proof_sets, roots, providers):
   
   a. **Finding Latest State**:
   - When updating a record (e.g., proof_set), first query the latest version by block number
   - Example: `SELECT * FROM proof_sets WHERE proof_id = 'xyz' ORDER BY block_number DESC LIMIT 1`
   
   b. **Update Decision**:
   - If latest record's block_number matches current processing block:
     - Update the existing row (same block updates)
     - Example: Multiple updates in block 100 modify same row
   - If block numbers differ:
     - Insert new row with current block number
     - Example: Update at block 120 for data last modified in block 100
   
   c. **Reorg Safety**:
   - This versioning strategy ensures clean reorgs
   - During reorg, can safely delete all rows where block_number >= fork_point
   - Previous versions remain intact for blocks before fork point
   
   Example:
   ```sql
   -- Initial state at block 100
   INSERT INTO proof_sets (proof_id, data, block_number) VALUES ('xyz', 'initial', 100);
   
   -- Update at block 100 (same block)
   UPDATE proof_sets 
   SET data = 'updated'
   WHERE proof_id = 'xyz' AND block_number = 100;
   
   -- Update at block 120 (different block)
   INSERT INTO proof_sets (proof_id, data, block_number)
   VALUES ('xyz', 'new_data', 120);
   
   -- During reorg at block 110
   DELETE FROM proof_sets WHERE block_number >= 110;
   -- Record from block 100 remains intact
   ```

### Reorg Processing Steps

1. **Initialization**
   - Lock reorg processing to prevent concurrent reorgs
   - Verify no overlapping reorgs are in progress
   - Create context with 10-minute timeout

2. **Data Cleanup**
   - Begin atomic transaction
   - Delete all data from fork point to current height
   - Affects all tables with block-number-based versioning

3. **Reprocessing**
   - Process blocks from fork point to current height in batches
   - Each block's transactions and events are reprocessed
   - New data is inserted with correct block numbers

4. **Completion**
   - Commit transaction if successful
   - Release reorg lock
   - Log completion status

## Concurrency Control

- Mutex-based locking prevents concurrent reorg processing
- Active reorgs are tracked with start/end heights
- Stale reorgs (>10 minutes) are automatically cleaned up
- Overlapping reorg attempts are rejected

## Error Handling

- Context cancellation checks throughout process
- Transaction rollback on failures
- Detailed error logging for debugging
- Maximum reorg depth enforcement

## Example Scenario

```
Original Chain:    A -> B -> C -> D
                          \
New Chain:                 -> C' -> D' -> E'

1. System detects parent hash mismatch at block C'
2. Traverses back to find fork point (B)
3. Calculates reorg depth (3 blocks)
4. Deletes data from blocks C and D
5. Processes new blocks C', D', E'
```

## Best Practices

1. Always use block numbers for versioning updatable data
2. Create new records for updates from different blocks
3. Implement atomic transactions for data consistency
4. Monitor reorg frequency and depth for system health
