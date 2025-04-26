export const networkMetricsQuery = `
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
}`

export const landingDataQuery = `
query LandingData($first: Int, $skip: Int, $orderDirection: OrderDirection) {
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
  providers(first: $first, skip: $skip, orderBy: createdAt, orderDirection: $orderDirection) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    createdAt
  }
  proofSets(first: $first, skip: $skip, orderBy: createdAt, orderDirection: $orderDirection) {
    id
    setId
    owner {
      address
    }
    isActive
    totalRoots
    totalDataSize
    createdAt
  }
}`

export const providerQuery = `
query Providers($first: Int, $skip: Int, $where: Provider_filter, $orderBy: Provider_orderBy) {
  providers(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: desc) {
    totalDataSize
    totalFaultedPeriods
    address
    totalProofSets
    totalRoots
    id
    proofSets {
      id
      setId
    }
    createdAt
  }
}`

export const providerWithProofSetsQuery = `
query ProviderWithProofSets($providerId: ID!) {
  provider(id: $providerId) {
    totalDataSize
    totalProofSets
    totalFaultedRoots
    totalFaultedPeriods
    address
    totalRoots
    id
    createdAt
    proofSets {
      isActive
      lastProvenEpoch
      createdAt
      setId
      totalDataSize
      totalRoots
    }
  }
}`

export const landingProofSetsQuery = `
query LandingProofSets($first: Int, $skip: Int, $where: ProofSet_filter, $orderBy: ProofSet_orderBy) {
  proofSets(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: desc) {
    id
    setId
    isActive
    totalRoots
    totalProofs
    totalProvedRoots
    createdAt
    totalDataSize
    nextChallengeEpoch
    lastProvenEpoch
    owner {
    address
    }
  }
}`

export const proofSetQuery = `
query ProofSet($where: ProofSet_filter, $first: Int, $skip: Int) {
  proofSets(where: $where, first: 1, skip: 0) {
    id
    setId
    isActive
    totalRoots
    totalProofs
    totalProvedRoots
    createdAt
    totalDataSize
    challengeRange
    lastProvenEpoch
    blockNumber
    leafCount
    listener
    nextChallengeEpoch
    totalFaultedPeriods
    totalFeePaid
    totalTransactions
    totalEventLogs
    updatedAt
    owner {
      address
    }
    roots(first: $first, skip: $skip, orderBy: rootId, orderDirection: desc) {
      id
      cid
      rootId
      rawSize
      removed
      totalProofsSubmitted
      totalPeriodsFaulted
      lastProvenEpoch
      lastProvenAt
      lastFaultedEpoch
      lastFaultedAt
    }
  }
}`

export const transactionsQuery = `
query Transactions($first: Int, $skip: Int, $where: Transaction_filter) {
  transactions(first: $first, skip: $skip, where: $where, orderBy: createdAt, orderDirection: desc) {
    hash
    height
    method
    status
    value
    createdAt
  }
}`

export const eventLogsQuery = `
query EventLogs($first: Int, $skip: Int, $where: EventLog_filter) {
  eventLogs(first: $first, skip: $skip, where: $where, orderBy: createdAt, orderDirection: desc) {
    name
    transactionHash
    blockNumber
    id
    createdAt
    data
  }
}`

export const rootsQuery = `
query Roots($first: Int, $skip: Int, $where: Root_filter) {
  roots(first: $first, skip: $skip, where: $where, orderBy: rootId, orderDirection: desc) {
    cid
    id
    lastFaultedAt
    lastFaultedEpoch
    lastProvenAt
    lastProvenEpoch
    rawSize
    rootId
    setId
    totalPeriodsFaulted
    totalProofsSubmitted
    updatedAt
    removed
    createdAt
    blockNumber
  }
}`

export const weeklyProviderActivitiesQuery = `
query WeeklyProviderActivities($where: WeeklyProviderActivity_filter) {
  weeklyProviderActivities(where: $where) {
    id
    providerId
    totalDataSizeAdded
    totalDataSizeRemoved
    totalFaultedPeriods
    totalProofs
    totalProofSetsCreated
    totalRootsAdded
    totalFaultedRoots
    totalRootsProved
    totalRootsRemoved
  }
}`

export const weeklyProofSetActivitiesQuery = `
query WeeklyProofSetActivities($where: WeeklyProofSetActivity_filter) {
  weeklyProofSetActivities(where: $where) {
    id
    proofSetId
    totalDataSizeAdded
    totalDataSizeRemoved
    totalFaultedPeriods
    totalProofs
    totalRootsAdded
    totalFaultedRoots
    totalRootsProved
    totalRootsRemoved
  }
}`
