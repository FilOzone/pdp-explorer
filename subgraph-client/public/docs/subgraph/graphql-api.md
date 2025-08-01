# PDP Scan GraphQL API Documentation

This document provides a comprehensive guide to the GraphQL API for the PDP Scan subgraph. It includes query examples, available parameters, and entity relationships to help you effectively interact with the PDP data.

## Table of Contents

- [Overview](#overview)
- [Common Query Parameters](#common-query-parameters)
- [Entity Relationships](#entity-relationships)
- [Query Examples](#query-examples)
  - [Network Metrics](#network-metrics)
  - [Providers](#providers)
  - [Data Sets](#proof-sets)
  - [Pieces](#roots)
  - [Transactions](#transactions)
  - [Event Logs](#event-logs)
  - [Fault Records](#fault-records)
  - [Activity Metrics](#activity-metrics)
- [Advanced Queries](#advanced-queries)

## Overview

The PDP Scan subgraph indexes data from the Proof of Data Possession (PDP) protocol on the Filecoin network. It provides structured access to providers, proof sets, roots, transactions, and various metrics.

## Common Query Parameters

Most queries support the following parameters:

| Parameter        | Description                              | Example                     |
| ---------------- | ---------------------------------------- | --------------------------- |
| `first`          | Number of results to return (pagination) | `first: 10`                 |
| `skip`           | Number of results to skip (pagination)   | `skip: 20`                  |
| `orderBy`        | Field to order results by                | `orderBy: createdAt`        |
| `orderDirection` | Direction of ordering (`asc` or `desc`)  | `orderDirection: desc`      |
| `where`          | Filter conditions                        | `where: { isActive: true }` |

## Entity Relationships

Understanding the relationships between entities helps in constructing effective queries:

- **Provider** → **DataSet**: One-to-many (A provider can have multiple proof sets)
- **DataSet** → **Root**: One-to-many (A proof set can have multiple roots)
- **DataSet** → **Transaction**: One-to-many (A proof set can have multiple transactions)
- **DataSet** → **EventLog**: One-to-many (A proof set can have multiple event logs)
- **Transaction** → **EventLog**: One-to-many (A transaction can have multiple event logs)
- **DataSet** → **FaultRecord**: One-to-many (A proof set can have multiple fault records)
- **Root** → **FaultRecord**: Many-to-many (Multiple roots can be in multiple fault records)
- **Provider** → **Weekly/MonthlyProviderActivity**: One-to-many (Time-based metrics)
- **DataSet** → **Weekly/MonthlyProofSetActivity**: One-to-many (Time-based metrics)

## Query Examples

### Network Metrics

Network metrics provide aggregate statistics about the entire PDP network.

#### Query All Network Metrics

```graphql
query NetworkMetrics {
  networkMetric(id: "0x7064705f6e6574776f726b5f7374617473") {
    id
    totalActiveProofSets
    totalActiveRoots
    totalDataSize
    totalFaultedRoots
    totalFaultedPeriods
    totalProofFeePaidInFil
    totalProofSets
    totalProofs
    totalProvedRoots
    totalProviders
    totalRoots
  }
}
```

### Providers

Providers are entities that manage proof sets in the PDP system.

#### Query All Providers

```graphql
query AllProviders($first: Int, $skip: Int) {
  providers(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    totalFaultedPeriods
    totalFaultedRoots
    createdAt
  }
}
```

#### Query Provider by ID

```graphql
query ProviderById($providerId: ID!) {
  provider(id: $providerId) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    totalFaultedPeriods
    totalFaultedRoots
    createdAt
    updatedAt
    blockNumber
  }
}
```

#### Query Provider with Data Sets

```graphql
query ProviderWithProofSets($providerId: ID!, $first: Int, $skip: Int) {
  provider(id: $providerId) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    totalFaultedRoots
    totalFaultedPeriods
    createdAt
    proofSets(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      setId
      isActive
      totalDataSize
      totalRoots
      createdAt
      lastProvenEpoch
    }
  }
}
```

#### Filter Providers by Criteria

```graphql
query FilteredProviders($minDataSize: BigInt) {
  providers(
    where: { totalDataSize_gte: $minDataSize }
    orderBy: totalDataSize
    orderDirection: desc
    first: 10
  ) {
    id
    address
    totalDataSize
    totalProofSets
    createdAt
  }
}
```

### Data Sets

Data Sets are collections of roots that providers maintain and prove possession of.

#### Query All Data Sets

```graphql
query AllProofSets($first: Int, $skip: Int) {
  proofSets(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    setId
    isActive
    totalRoots
    totalProofs
    totalDataSize
    createdAt
    owner {
      address
    }
  }
}
```

#### Query Data Set by ID

```graphql
query ProofSetById($proofSetId: ID!) {
  proofSet(id: $proofSetId) {
    id
    setId
    isActive
    owner {
      id
      address
    }
    leafCount
    challengeRange
    lastProvenEpoch
    nextChallengeEpoch
    totalRoots
    totalDataSize
    totalProofs
    totalProvedRoots
    totalFeePaid
    totalFaultedPeriods
    totalFaultedRoots
    createdAt
    updatedAt
    blockNumber
  }
}
```

#### Query Data Set with Pieces

```graphql
query ProofSetWithRoots($proofSetId: ID!, $first: Int, $skip: Int) {
  proofSet(id: $proofSetId) {
    id
    setId
    isActive
    totalRoots
    totalDataSize
    roots(first: $first, skip: $skip, orderBy: rootId, orderDirection: desc) {
      id
      rootId
      rawSize
      cid
      removed
      totalProofsSubmitted
      totalPeriodsFaulted
      lastProvenEpoch
      lastProvenAt
      createdAt
    }
  }
}
```

#### Filter Data Sets by Status

```graphql
query ActiveProofSets($first: Int) {
  proofSets(
    where: { isActive: true }
    orderBy: totalDataSize
    orderDirection: desc
    first: $first
  ) {
    id
    setId
    totalRoots
    totalDataSize
    createdAt
    owner {
      address
    }
  }
}
```

### Pieces

Pieces represent data commitments within proof sets.

#### Query All Pieces

```graphql
query AllRoots($first: Int, $skip: Int) {
  roots(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
    id
    rootId
    setId
    rawSize
    cid
    removed
    totalProofsSubmitted
    totalPeriodsFaulted
    createdAt
    proofSet {
      id
      setId
    }
  }
}
```

#### Query Root by ID

```graphql
query RootById($rootId: ID!) {
  root(id: $rootId) {
    id
    rootId
    setId
    rawSize
    leafCount
    cid
    removed
    totalProofsSubmitted
    totalPeriodsFaulted
    lastProvenEpoch
    lastProvenAt
    lastFaultedEpoch
    lastFaultedAt
    createdAt
    updatedAt
    blockNumber
    proofSet {
      id
      setId
      owner {
        address
      }
    }
  }
}
```

#### Filter Pieces by Criteria

```graphql
query FilteredRoots($minSize: BigInt, $isRemoved: Boolean) {
  roots(
    where: { rawSize_gte: $minSize, removed: $isRemoved }
    orderBy: rawSize
    orderDirection: desc
    first: 10
  ) {
    id
    rootId
    setId
    rawSize
    cid
    createdAt
    proofSet {
      id
      owner {
        address
      }
    }
  }
}
```

### Transactions

Transactions record blockchain interactions related to the PDP protocol.

#### Query All Transactions

```graphql
query AllTransactions($first: Int, $skip: Int) {
  transactions(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    hash
    proofSetId
    height
    fromAddress
    toAddress
    value
    method
    status
    createdAt
  }
}
```

#### Query Transactions for a Data Set

```graphql
query ProofSetTransactions($proofSetId: BigInt!, $first: Int, $skip: Int) {
  transactions(
    where: { proofSetId: $proofSetId }
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    hash
    height
    fromAddress
    toAddress
    value
    method
    status
    createdAt
    eventLogs {
      id
      name
      data
    }
  }
}
```

#### Filter Transactions by Method

```graphql
query TransactionsByMethod($method: String!, $first: Int) {
  transactions(
    where: { method: $method }
    orderBy: createdAt
    orderDirection: desc
    first: $first
  ) {
    id
    hash
    proofSetId
    method
    status
    createdAt
    proofSet {
      id
      setId
      owner {
        address
      }
    }
  }
}
```

### Event Logs

Event Logs capture events emitted during transactions.

#### Query All Event Logs

```graphql
query AllEventLogs($first: Int, $skip: Int) {
  eventLogs(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    setId
    address
    name
    data
    logIndex
    transactionHash
    createdAt
    blockNumber
  }
}
```

#### Query Event Logs by Name

```graphql
query EventLogsByName($eventName: String!, $first: Int) {
  eventLogs(
    where: { name: $eventName }
    orderBy: createdAt
    orderDirection: desc
    first: $first
  ) {
    id
    name
    data
    transactionHash
    createdAt
    proofSet {
      id
      setId
    }
    transaction {
      hash
      method
    }
  }
}
```

#### Query Event Logs for a Data Set

```graphql
query ProofSetEventLogs($proofSetId: BigInt!, $first: Int, $skip: Int) {
  eventLogs(
    where: { setId: $proofSetId }
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    name
    data
    transactionHash
    createdAt
    blockNumber
  }
}
```

### Fault Records

Fault Records track instances where providers failed to prove data possession.

#### Query All Fault Records

```graphql
query AllFaultRecords($first: Int, $skip: Int) {
  faultRecords(
    first: $first
    skip: $skip
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    proofSetId
    rootIds
    currentChallengeEpoch
    nextChallengeEpoch
    periodsFaulted
    deadline
    createdAt
    blockNumber
  }
}
```

#### Query Fault Records for a Data Set

```graphql
query ProofSetFaultRecords($proofSetId: BigInt!, $first: Int) {
  faultRecords(
    where: { proofSetId: $proofSetId }
    first: $first
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    rootIds
    periodsFaulted
    deadline
    createdAt
    proofSet {
      id
      setId
    }
    roots {
      id
      rootId
      cid
    }
  }
}
```

### Activity Metrics

Activity metrics track provider and proof set performance over time.

#### Query Weekly Provider Activities

```graphql
query ProviderWeeklyActivities($providerId: Bytes!) {
  weeklyProviderActivities(
    where: { providerId: $providerId }
    orderBy: id
    orderDirection: desc
  ) {
    id
    totalRootsAdded
    totalDataSizeAdded
    totalRootsRemoved
    totalDataSizeRemoved
    totalProofSetsCreated
    totalProofs
    totalRootsProved
    totalFaultedRoots
    totalFaultedPeriods
  }
}
```

#### Query Monthly Provider Activities

```graphql
query ProviderMonthlyActivities($providerId: Bytes!) {
  monthlyProviderActivities(
    where: { providerId: $providerId }
    orderBy: id
    orderDirection: desc
  ) {
    id
    totalProofSetsCreated
    totalRootsAdded
    totalDataSizeAdded
    totalRootsRemoved
    totalDataSizeRemoved
    totalProofs
    totalRootsProved
    totalFaultedRoots
    totalFaultedPeriods
  }
}
```

#### Query Weekly Data Set Activities

```graphql
query ProofSetWeeklyActivities($proofSetId: BigInt!) {
  weeklyProofSetActivities(
    where: { proofSetId: $proofSetId }
    orderBy: id
    orderDirection: desc
  ) {
    id
    totalRootsAdded
    totalDataSizeAdded
    totalRootsRemoved
    totalDataSizeRemoved
    totalProofs
    totalRootsProved
    totalFaultedRoots
    totalFaultedPeriods
  }
}
```

#### Query Monthly Data Set Activities

```graphql
query ProofSetMonthlyActivities($proofSetId: BigInt!) {
  monthlyProofSetActivities(
    where: { proofSetId: $proofSetId }
    orderBy: id
    orderDirection: desc
  ) {
    id
    totalRootsAdded
    totalDataSizeAdded
    totalRootsRemoved
    totalDataSizeRemoved
    totalProofs
    totalRootsProved
    totalFaultedRoots
    totalFaultedPeriods
  }
}
```

## Advanced Queries

### Combined Provider and Data Set Data

```graphql
query ProviderWithDetailedProofSets($providerId: ID!, $first: Int, $skip: Int) {
  provider(id: $providerId) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    totalFaultedRoots
    totalFaultedPeriods
    proofSets(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      setId
      isActive
      totalRoots
      totalDataSize
      totalProofs
      totalProvedRoots
      totalFaultedPeriods
      lastProvenEpoch
      nextChallengeEpoch
      createdAt
      roots(first: 5, orderBy: rootId, orderDirection: desc) {
        id
        rootId
        rawSize
        cid
        removed
        lastProvenEpoch
      }
    }
    weeklyProviderActivities(first: 4, orderBy: id, orderDirection: desc) {
      id
      totalRootsAdded
      totalDataSizeAdded
      totalProofs
    }
  }
}
```

### Network Overview with Recent Activity

```graphql
query NetworkOverview($first: Int) {
  networkMetric(id: "0x7064705f6e6574776f726b5f7374617473") {
    totalActiveProofSets
    totalDataSize
    totalProofFeePaidInFil
    totalProviders
    totalRoots
  }
  recentProviders: providers(
    first: $first
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    address
    totalDataSize
    totalProofSets
    createdAt
  }
  recentProofSets: proofSets(
    first: $first
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    setId
    isActive
    totalDataSize
    createdAt
    owner {
      address
    }
  }
  recentRoots: roots(first: $first, orderBy: createdAt, orderDirection: desc) {
    id
    rootId
    setId
    rawSize
    createdAt
  }
}
```

### Search by Provider or Data Set ID

```graphql
query Search($providerId: ID, $proofSetId: Bytes) {
  # Search for provider
  provider(id: $providerId) {
    id
    address
    totalProofSets
    totalDataSize
  }
  # Search for proof set
  proofSets(where: { id: $proofSetId }) {
    id
    setId
    isActive
    totalDataSize
    owner {
      address
    }
  }
}
```

## Conclusion

This documentation provides a comprehensive overview of the GraphQL API for the PDP Scan subgraph. By using these query examples and understanding the entity relationships, you can effectively interact with and analyze data from the Proof of Data Possession protocol on the Filecoin network.

For more information on how to deploy your own subgraph, refer to the [Deployment Guide](./deployment).
