# Integration Architecture

## Overview

The PDP Explorer backend integrates with multiple systems to provide a comprehensive view of PDP data. This document details the key integration points between the indexer, API server, blockchain, and frontend, as well as the data flow between these components.

## Integration Points

### 1. Blockchain Integration

#### Connection Details

The indexer connects to the Filecoin blockchain through the following methods:

- **Primary Connection**: Glif Node API endpoint
- **Protocol**: JSON-RPC over HTTPS
- **Configuration**: Environment variables

```
LOTUS_API_ENDPOINT=https://api.node.glif.io/rpc/v1
LOTUS_API_KEY=your-api-key
```

#### Data Retrieval

The indexer retrieves blockchain data through several API calls:

1. **Chain Height**:

   ```
   eth_blockNumber
   ```

2. **Block Headers**:

   ```
   eth_getBlockByNumber(blockNumber, false)
   ```

3. **Block with Transactions**:

   ```
   eth_getBlockByNumber(blockNumber, true)
   ```

4. **Transaction Receipts**:

   ```
   eth_getTransactionReceipt(transactionHash)
   ```

5. **Message Cid**:

   ```
   eth_getMessageCidByTransactionHash(transactionHash)
   ```

#### Reorg Detection

The system detects chain reorganizations by comparing parent hashes:

```
currentBlock.parentHash != storedBlock.hash
```

When a reorg is detected, the system traverses the chain backwards to find the fork point and reprocesses blocks from that point.

Read more about reorg handling in PDP Explorer [here](./REORG_HANDLING.md).

### 2. Database Integration

The backend uses PostgreSQL for data persistence:

- **Connection**: Connection pooling for efficient resource utilization
- **Migration**: Version-controlled schema migrations
- **Transactions**: ACID transactions for data consistency during reorgs

### 3. API Server Integration

The API server provides RESTful endpoints for the frontend:

- **Framework**: Gin web framework
- **Routing**: Path-based routing with parameter extraction
- **Response Format**: JSON with consistent envelope pattern

#### API Routes

Core routes are defined in the OpenAPI specification [here](./server/openapi.yaml).

### 4. Frontend Integration

The API server integrates with the frontend through:

- **CORS**: Cross-Origin Resource Sharing enabled for frontend domains
- **Pagination**: Consistent limit/offset parameters
- **Filtering**: Query parameters for data filtering
- **Sorting**: Support for multiple sort criteria

## Data Flow Architecture

### Complete Data Flow

```
                   ┌────────────┐
                   │            │
                   │ Blockchain │
                   │            │
                   └─────┬──────┘
                         │
                         ▼
┌──────────────────────────────────────────┐
│                                          │
│ ┌──────────┐    ┌─────────┐    ┌───────┐ │
│ │          │    │         │    │       │ │
│ │ Indexer  ├───►│Processor├───►│Handler│ │
│ │          │    │         │    │       │ │
│ └──────────┘    └─────────┘    └───┬───┘ │
│                                    │     │
│                                    ▼     │
│                              ┌───────────┴─┐
│                              │             │
│                              │  Database   │
│                              │             │
│                              └─────┬───────┘
│                                    │
│                                    ▼
│                              ┌───────────┐
│                              │           │
│                              │ API Server│
│                              │           │
│                              └─────┬─────┘
└──────────────────────────────────┬─┘
                                   │
                                   ▼
                             ┌──────────┐
                             │          │
                             │ Frontend │
                             │          │
                             └──────────┘
```

### Indexer Data Flow

```
┌───────────┐    ┌───────────┐    ┌───────────┐
│           │    │           │    │           │
│ Block Data├───►│Transaction├───►│Transaction│
│           │    │  Handler  │    │   Data    │
└─────┬─────┘    └───────────┘    └───────────┘
      │
      │          ┌───────────┐    ┌───────────┐
      │          │           │    │           │
      └─────────►│Event Log  ├───►│  Event    │
                 │  Handler  │    │   Data    │
                 └───────────┘    └───────────┘
```

## API Server Data Flow

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│            │    │            │    │            │
│HTTP Request├───►│ Controller ├───►│  Service   │
│            │    │            │    │            │
└────────────┘    └────────────┘    └─────┬──────┘
                                          │
                                          ▼
                                    ┌────────────┐
                                    │            │
                                    │ Repository │
                                    │            │
                                    └─────┬──────┘
                                          │
                                          ▼
                                    ┌────────────┐
                                    │            │
                                    │  Database  │
                                    │            │
                                    └────────────┘
```

## Future Integration Considerations

1. **GraphQL API**: More flexible querying for complex data relationships
