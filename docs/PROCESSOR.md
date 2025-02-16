# Processor Architecture

## Overview

The Processor is a crucial component that sits between the Indexer and Handlers, responsible for efficiently processing blockchain data and routing it to appropriate handlers. It implements parallel processing of transactions and logs while maintaining data consistency and error handling.

## Data Flow

```
Indexer -> Processor -> Handlers
   |          |            |
   |          |            └─ Process specific events/calls
   |          └─ Parallel processing & routing
   └─ Block data (txs & logs)
```

## Processing Pipeline

### 1. Block Data Reception

- Receives `BlockData` from Indexer containing:
  - Transactions from the block
  - Event logs from the block
- Creates a transaction map for quick lookups: `map[txHash]Transaction`

### 2. Parallel Processing

The processor employs a worker pool pattern for concurrent processing:

```go
// Worker pool initialization
workerPool := make(chan struct{}, maxWorkers)
```

- **Transaction Processing**

  - Each transaction processed in separate goroutine
  - Worker pool controls concurrent execution
  - Context cancellation handled gracefully

- **Log Processing**
  - Each log processed in separate goroutine
  - Associated transaction data available via txMap
  - Same worker pool mechanism as transactions

### 3. Signature Matching

#### Transaction Matching

```
Contract Call:
┌─────────────────┐
│ Contract Address│ ──┐
├─────────────────┤   │    ┌─────────────┐
│ Function Selector│ ──┴──► │ Match Found │ ──► Call Handler
└─────────────────┘        └─────────────┘
```

1. Extracts function selector from transaction input
2. Matches against configured contract addresses
3. Compares function selector with generated signatures
4. Routes to registered handler if match found

#### Log Matching

```
Event Log:
┌─────────────────┐
│ Contract Address│ ──┐
├─────────────────┤   │    ┌─────────────┐
│     Topic[0]    │ ──┴──► │ Match Found │ ──► Call Handler
└─────────────────┘        └─────────────┘
```

1. Uses contract address and first topic (event signature)
2. Matches against configured event definitions
3. Routes to registered handler if match found

### 4. Handler Execution

#### Transaction Handlers

- Receive transaction data only
- Access to:
  - Transaction hash
  - Input data
  - From/To addresses
  - Value
  - Block information

#### Log Handlers

- Receive both log and associated transaction
- Access to:
  - Event data (topics and data)
  - Transaction context
  - Block information

## Error Handling

1. **Concurrent Error Collection**

   - Uses error channel to collect errors from goroutines
   - Channel sized to match maximum possible errors
   - Prevents goroutine leaks

2. **Error Aggregation**
   - Collects all errors from processing
   - Returns combined error if any failures
   - Continues processing despite individual failures

## Configuration

The processor is configured via a config file that defines:

1. **Contract Definitions**

   - Addresse to monitor
   - Function definitions to track
   - Event definitions to capture

2. **Handler Mappings**
   - handler name → Handler

## Example Configuration

```yaml
Resources:
  - Name: "PDPVerifier"
    Address: "0x123..."
    Triggers:
      - Type: "event"
        Definition: "ProofSetCreated(uint256 indexed setId, address indexed owner)"
        Handler: "ProofSetCreatedHandler"
      - Type: "function"
        Definition: "proposeProofSetOwner(uint256 setId, address newOwner)"
        Handler: "TransactionHandler"

This configuration would generate appropriate signatures and route matching transactions and logs to their respective handlers.
```
