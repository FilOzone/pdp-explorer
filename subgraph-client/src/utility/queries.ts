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
query LandingData($first: Int, $skip: Int,  $where: Provider_filter, $orderDirection: OrderDirection) {
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
  providers(first: $first, skip: $skip, orderBy: createdAt, where: $where, orderDirection: $orderDirection) {
    id
    address
    totalDataSize
    totalProofSets
    totalRoots
    createdAt
  }
  dataSets(first: $first, skip: $skip, orderBy: createdAt, orderDirection: $orderDirection) {
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
query ProviderWithProofSets($providerId: ID!, $first: Int, $skip: Int) {
  provider(id: $providerId) {
    totalDataSize
    totalProofSets
    totalFaultedRoots
    totalFaultedPeriods
    address
    totalRoots
    id
    createdAt
    proofSets(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
      isActive
      lastProvenEpoch
      createdAt
      setId
      totalDataSize
      totalRoots
    }
  }
}`

export const pieceDetailsQuery = `
query pieceDetails($cid: String!) {
  roots(where: {cid: $cid}) {
    setId
    cid
    proofSet {
      owner {
        address
        totalProofSets
        totalRoots
      }
      id
      blockNumber
      setId
      isActive
      totalDataSize
      totalRoots
      lastProvenEpoch
      createdAt
      updatedAt
    }
  }
}`

export const landingProofSetsQuery = `
query LandingProofSets($first: Int, $skip: Int, $where: DataSet_filter, $orderBy: DataSet_orderBy) {
  dataSets(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: desc) {
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
query DataSet($where: DataSet_filter, $first: Int, $skip: Int) {
  dataSets(where: $where, first: 1, skip: 0) {
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
query Pieces($first: Int, $skip: Int, $where: Root_filter) {
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
    dataSetId
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

export const monthlyProofSetActivitiesQuery = `
query MonthlyProofSetActivities($where: MonthlyProofSetActivity_filter) {
  monthlyProofSetActivities(where: $where) {
    id
    dataSetId
    totalDataSizeAdded
    totalDataSizeRemoved
    totalFaultedPeriods
    totalFaultedRoots
    totalProofs
    totalRootsAdded
    totalRootsProved
    totalRootsRemoved
  }
}`

export const servicesQuery = `
query Services($first: Int, $skip: Int, $where: Service_filter, $orderBy: Service_orderBy) {
  services(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: desc) {
    id
    address
    totalProofSets
    totalProviders
    totalRoots
    totalDataSize
    totalFaultedRoots
    totalFaultedPeriods
    createdAt
    updatedAt
  }
  networkMetric(id: "0x7064705f6e6574776f726b5f7374617473") {
    totalProofSets
  }
}`

export const serviceDetailsQuery = `
query ServiceDetails($serviceId: ID!, $first: Int, $skip: Int) {
  service(id: $serviceId) {
    id
    address
    totalProofSets
    totalProviders
    totalRoots
    totalDataSize
    totalFaultedRoots
    totalFaultedPeriods
    createdAt
    updatedAt
    proofSets(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
      id
      setId
      isActive
      totalRoots
      totalProvedRoots
      totalDataSize
      lastProvenEpoch
      nextChallengeEpoch
      createdAt
      owner {
        address
      }
    }
  }
}`

export const serviceProvidersQuery = `
query ServiceProviders($serviceId: ID!, $first: Int, $skip: Int) {
  service(id: $serviceId) {
    id
    address
    providerLinks(first: $first, skip: $skip) {
      id
      totalProofSets
      provider {
        id
        address
        totalProofSets
        totalRoots
        totalDataSize
        totalFaultedRoots
        totalFaultedPeriods
        createdAt
      }
    }
  }
}`

export const providerAndProofSetQuery = `
query ProviderAndProofSet($where_provider: Provider_filter, $where_proofset: ProofSet_filter, $where_root: Root_filter) {
  providers(where: $where_provider) {
    totalDataSize
    address
    totalProofSets
    id
    createdAt
  }
  dataSets(where: $where_proofset) {
    id
    setId
    createdAt
    totalDataSize
    owner {
    address
    }
  }
  roots(where: $where_root) {
    rootId
    cid
    rawSize
    proofSet {
      setId
      totalRoots
      owner {
        address
      }
    }
  }
}`
