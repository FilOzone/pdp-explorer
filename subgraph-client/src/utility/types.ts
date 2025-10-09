export interface NetworkMetrics {
  id: string
  totalActiveProofSets: string
  totalActiveRoots: string
  totalDataSize: string
  totalFaultedRoots: string
  totalFaultedPeriods: string
  totalProofFeePaidInFil: string
  totalProofSets: string
  totalProofs: string
  totalProvedRoots: string
  totalProviders: string
  totalRoots: string
}

export interface Provider {
  id: string
  address: string
  totalRoots: string
  totalFaultedPeriods: string
  totalFaultedRoots: string
  totalDataSize: string
  totalProofSets: string
  createdAt: string
  updatedAt: string
  blockNumber: string
  dataSets: DataSet[]
  proofSets: DataSet[]
}

export interface DataSet {
  id: string
  setId: string
  isActive: boolean
  totalRoots: string
  totalProofs: string
  totalProvedRoots: string
  totalDataSize: string
  totalFaultedPeriods: string
  totalFeePaid: string
  nextChallengeEpoch: string
  lastProvenEpoch: string
  createdAt: string
  updatedAt: string
  blockNumber: string
  listener: string
  totalTransactions: string
  totalEventLogs: string
  challengeRange: string
  leafCount: string
  owner: Provider
  roots?: Root[]
}

export interface Root {
  id: string
  rootId: string
  cid: string
  rawSize: string
  removed: boolean
  totalProofsSubmitted: string
  totalPeriodsFaulted: string
  lastProvenEpoch: string
  lastFaultedEpoch: string
  lastProvenAt: string
  lastFaultedAt: string

  proofSet?: DataSet
}

export interface Transaction {
  id: string
  hash: string
  height: string
  method: string
  status: string
  value: string
  createdAt: string
}

export interface EventLog {
  id: string
  name: string
  transactionHash: string
  blockNumber: string
  createdAt: string
  data: string
}

interface Activity {
  id: string
  totalDataSizeAdded: string
  totalDataSizeRemoved: string
  totalFaultedPeriods: string
  totalProofs: string
  totalRootsAdded: string
  totalFaultedRoots: string
  totalRootsProved: string
  totalRootsRemoved: string
}

export interface WeeklyProviderActivity extends Activity {
  providerId: string
  totalProofSetsCreated: string
}

export interface MonthlyProviderActivity extends Activity {
  providerId: string
  totalProofSetsCreated: string
}

export interface WeeklyProofSetActivity extends Activity {
  dataSetId: string
}

export interface MonthlyProofSetActivity extends Activity {
  dataSetId: string
}

export interface ProviderLink {
  id: string
  totalProofSets: string
  service: Service
  provider: Provider
}

export interface Service {
  id: string
  address: string
  totalProofSets: string
  totalProviders: string
  totalRoots: string
  totalDataSize: string
  totalFaultedRoots: string
  totalFaultedPeriods: string
  createdAt: string
  updatedAt: string
  dataSets?: DataSet[]
  providerLinks?: ProviderLink[]
}
