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
  proofSets: ProofSet[]
}

export interface ProofSet {
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
  proofSetId: string
}

export interface MonthlyProofSetActivity extends Activity {
  proofSetId: string
}
