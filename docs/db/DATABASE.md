# Database Architecture

## Table of Contents
- [Overview](#overview)
- [Schema Design](#schema-design)
- [Performance Improvements](#2-performance-improvements)
- [Database Versioning](#3-database-versioning)
- [Database Management](#database-management)

## Overview

The PDP Explorer uses PostgreSQL as its primary database, with a schema designed for high performance, data integrity, and support for chain reorganizations. This document details the database structure, relationships, and recent optimizations.

## Schema Design

### Core Tables

#### 1. `blocks`

Tracks processed blocks and their finalization status.

| Column           | Type                       | Description                                     |
| ---------------- | -------------------------- | ----------------------------------------------- |
| height           | BIGINT                     | Block height (primary key)                      |
| hash             | TEXT                       | Block hash                                      |
| parent_hash      | TEXT                       | Parent block hash                               |
| timestamp        | BIGINT                     | Block timestamp                                 |
| is_processed     | BOOLEAN                    | Whether block is processed (default: false)     |
| created_at       | TIMESTAMP WITH TIME ZONE   | Creation timestamp (default: CURRENT_TIMESTAMP) |

**Indices:**

- Index on `height`
- Index on `is_processed`

#### 2. `providers`

Stores provider information with version control.

| Column                | Type                     | Description                                         |
| --------------------- | ------------------------ | --------------------------------------------------- |
| id                    | BIGSERIAL                | Internal ID (primary key)                           |
| address               | TEXT                     | Provider address (normalized)                       |
| total_faulted_periods | BIGINT                   | Total number of faulted periods (default: 0)        |
| total_data_size       | TEXT                     | Total size of data                                  |
| proof_set_ids         | BIGINT[]                 | Array of proof set IDs (default: '{}')              |
| block_number          | BIGINT                   | Block where this record was created/updated         |
| block_hash            | TEXT                     | Hash of the block                                   |
| created_at            | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)     |
| updated_at            | TIMESTAMP WITH TIME ZONE | Last update timestamp (default: CURRENT_TIMESTAMP)  |

**Indices:**

- `idx_providers_address`: Index on `address`
- `idx_providers_block_number`: Index on `block_number`
- Unique constraint on `(address, block_number)`

#### 3. `proof_sets`

Maintains proof set metadata and status.

| Column                | Type                     | Description                                         |
| --------------------- | ------------------------ | --------------------------------------------------- |
| id                    | BIGSERIAL                | Internal ID (primary key)                           |
| set_id                | BIGINT                   | On-chain proof set ID                               |
| owner                 | TEXT                     | Current owner address                               |
| listener_addr         | TEXT                     | Listener address                                    |
| total_faulted_periods | BIGINT                   | Total number of faulted periods (default: 0)        |
| total_data_size       | TEXT                     | Total size of data                                  |
| total_roots           | BIGINT                   | Total number of roots (default: 0)                  |
| total_proved_roots    | BIGINT                   | Total number of proved roots (default: 0)           |
| total_fee_paid        | TEXT                     | Total fee paid                                      |
| last_proven_epoch     | BIGINT                   | Last proven epoch (default: 0)                      |
| next_challenge_epoch  | BIGINT                   | Next challenge epoch (default: 0)                   |
| is_active             | BOOLEAN                  | Whether proof set is active (default: true)         |
| block_number          | BIGINT                   | Block where this record was created/updated         |
| block_hash            | TEXT                     | Hash of the block                                   |
| created_at            | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)     |
| updated_at            | TIMESTAMP WITH TIME ZONE | Last update timestamp (default: CURRENT_TIMESTAMP)  |

**Indices:**

- `idx_proof_sets_set_id`: Index on `set_id`
- `idx_proof_sets_set_owner`: Index on `owner`
- `idx_proof_sets_block_number`: Index on `block_number`
- Unique constraint on `(set_id, block_number)`

#### 4. `roots`

Stores root data associated with proof sets.

| Column                | Type                     | Description                                        |
| --------------------- | ------------------------ | -------------------------------------------------- |
| id                    | BIGSERIAL                | Internal ID (primary key)                          |
| root_id               | BIGINT                   | On-chain root ID                                   |
| size                  | BIGINT                   | Size of the root data                              |
| cid                   | TEXT                     | Content identifier                                 |
| ipfs_url              | TEXT                     | IPFS URL for this root                             |
| provider_id           | BIGINT                   | Associated provider ID                             |
| set_id                | BIGINT                   | Associated proof set ID                            |
| proved                | BOOLEAN                  | Whether the root has been proved                   |
| epoch                 | BIGINT                   | Epoch number                                       |
| is_fresh              | BOOLEAN                  | Whether the root is fresh                          |
| block_number          | BIGINT                   | Block where this root was added                    |
| block_hash            | TEXT                     | Hash of the block                                  |
| created_at            | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)    |
| updated_at            | TIMESTAMP WITH TIME ZONE | Last update timestamp (default: CURRENT_TIMESTAMP) |

**Indices:**

- `idx_roots_root_id`: Index on `root_id`
- `idx_roots_set_id`: Index on `set_id`
- `idx_roots_provider_id`: Index on `provider_id`
- `idx_roots_block_number`: Index on `block_number`
- Unique constraint on `(root_id, block_number)`

#### 5. `transactions`

Records all relevant blockchain transactions.

| Column          | Type                     | Description                                         |
| --------------- | ------------------------ | --------------------------------------------------- |
| id              | BIGSERIAL                | Internal ID (primary key)                           |
| tx_hash         | TEXT                     | Transaction hash                                    |
| proof_set_id    | BIGINT                   | Associated proof set ID                             |
| from_address    | TEXT                     | Sender address                                      |
| to_address      | TEXT                     | Recipient address                                   |
| value           | TEXT                     | Transaction value                                   |
| gas_spent       | BIGINT                   | Gas spent in the transaction                        |
| gas_price       | TEXT                     | Gas price in wei                                    |
| gas_limit       | BIGINT                   | Gas limit                                           |
| status          | BOOLEAN                  | Status of the transaction (success/failure)         |
| chain_id        | BIGINT                   | Chain ID                                            |
| nonce           | BIGINT                   | Transaction nonce                                   |
| block_number    | BIGINT                   | Block number where transaction was included         |
| block_hash      | TEXT                     | Hash of the block                                   |
| created_at      | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)     |

**Indices:**

- `idx_transactions_tx_hash`: Index on `tx_hash` for quick lookups
- `idx_transactions_proof_set_id`: Index on `proof_set_id`
- `idx_transactions_from_address`: Index on `from_address`
- `idx_transactions_to_address`: Index on `to_address`
- `idx_transactions_block_number`: Index on `block_number` for reorg handling

#### 6. `event_logs`

Stores blockchain events and their metadata.

| Column           | Type                     | Description                                       |
| ---------------- | ------------------------ | ------------------------------------------------- |
| id               | BIGSERIAL                | Internal ID (primary key)                         |
| tx_hash          | TEXT                     | Associated transaction hash                       |
| block_number     | BIGINT                   | Block number where event occurred                 |
| block_hash       | TEXT                     | Hash of the block                                 |
| log_index        | BIGINT                   | Index of log within the block                     |
| contract_address | TEXT                     | Contract address emitting the event               |
| event_index      | INTEGER                  | Index of the event                                |
| event_type       | TEXT                     | Type of event                                     |
| data             | JSONB                    | Non-indexed event data stored as JSONB             |
| entity_id        | BIGINT                   | Associated entity ID                              |
| is_processed     | BOOLEAN                  | Whether the event has been processed              |
| is_deletion      | BOOLEAN                  | Whether this is a deletion event for reorgs       |
| created_at       | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)   |

**Indices:**

- `idx_event_logs_tx_hash`: Index on `tx_hash`
- `idx_event_logs_block_number`: Index on `block_number` for reorg handling
- `idx_event_logs_contract_address`: Index on `contract_address`
- `idx_event_logs_event_type`: Index on `event_type`
- `idx_event_logs_entity_id`: Index on `entity_id`
- Index on `(tx_hash, log_index)` with uniqueness constraint

#### 7. `proofs`

Stores individual proof submissions.

| Column           | Type                     | Description                                        |
| ---------------- | ------------------------ | -------------------------------------------------- |
| id               | BIGSERIAL                | Internal ID (primary key)                          |
| proof_id         | BIGINT                   | On-chain proof ID                                  |
| offset           | BIGINT                   | Proof offset                                       |
| merkle_proof     | TEXT                     | Merkle proof data                                  |
| root_id          | BIGINT                   | Associated root ID                                 |
| provider_id      | BIGINT                   | Associated provider ID                             |
| set_id           | BIGINT                   | Associated proof set ID                            |
| tx_hash          | TEXT                     | Transaction hash of the proof submission           |
| block_number     | BIGINT                   | Block number where proof was submitted             |
| block_hash       | TEXT                     | Hash of the block                                  |
| created_at       | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)    |
| updated_at       | TIMESTAMP WITH TIME ZONE | Last update timestamp (default: CURRENT_TIMESTAMP) |

**Indices:**

- `idx_proofs_proof_id`: Index on `proof_id`
- `idx_proofs_set_id`: Index on `set_id`
- `idx_proofs_root_id`: Index on `root_id`
- `idx_proofs_provider_id`: Index on `provider_id`
- `idx_proofs_block_number`: Index on `block_number` for reorg handling
- Unique constraint on `(proof_id, block_number)`

#### 8. `proof_fees`

Stores proof fee information.

| Column           | Type                     | Description                                        |
| ---------------- | ------------------------ | -------------------------------------------------- |
| id               | BIGSERIAL                | Internal ID (primary key)                          |
| fee_id           | BIGINT                   | On-chain fee ID                                    |
| fee              | TEXT                     | Proof fee amount                                   |
| block_number     | BIGINT                   | Block number where fee was recorded                |
| block_hash       | TEXT                     | Hash of the block                                  |
| created_at       | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)    |

**Indices:**

- `idx_proof_fees_fee_id`: Index on `fee_id`
- `idx_proof_fees_block_number`: Index on `block_number` for reorg handling
- Unique constraint on `(fee_id, block_number)`

#### 9. `fault_records`

Stores provider fault information.

| Column                | Type                     | Description                                        |
| --------------------- | ------------------------ | -------------------------------------------------- |
| id                    | BIGSERIAL                | Internal ID (primary key)                          |
| fault_id              | BIGINT                   | On-chain fault ID                                  |
| provider_id           | BIGINT                   | Associated provider ID                             |
| provider_address      | TEXT                     | Provider address                                   |
| set_id                | BIGINT                   | Associated proof set ID                            |
| period                | INTEGER                  | Fault period                                       |
| faulted_epoch         | BIGINT                   | Epoch when fault occurred                          |
| fault_type            | TEXT                     | Type of fault                                      |
| block_number          | BIGINT                   | Block number where fault was recorded              |
| block_hash            | TEXT                     | Hash of the block                                  |
| created_at            | TIMESTAMP WITH TIME ZONE | Creation timestamp (default: CURRENT_TIMESTAMP)    |
| updated_at            | TIMESTAMP WITH TIME ZONE | Last update timestamp (default: CURRENT_TIMESTAMP) |

**Indices:**

- `idx_fault_records_fault_id`: Index on `fault_id`
- `idx_fault_records_provider_id`: Index on `provider_id`
- `idx_fault_records_provider_address`: Index on `provider_address`
- `idx_fault_records_set_id`: Index on `set_id`
- `idx_fault_records_block_number`: Index on `block_number` for reorg handling
- Unique constraint on `(fault_id, block_number)`

### 2. Performance Improvements

1. **Added Composite Indices**

   - Added composite indices for frequently joined queries
   - Improved query performance for filtered searches

2. **Optimized Join Patterns**

   - Structured queries to leverage existing indices
   - Reduced table scan operations

3. **Query Optimization**
   - Implemented pagination for large result sets
   - Added proper sorting indices

### 3. Database Versioning

Implemented block-based versioning for all tables that require reorg support:

```sql
-- Example of retrieval pattern
SELECT * FROM proof_sets
WHERE proof_set_id = ? AND block_number <= ?
ORDER BY block_number DESC LIMIT 1;
```

## Database Management

### Migrations

Database schema changes are managed through migration files located in:

```
backend/indexer/migrations/
```
