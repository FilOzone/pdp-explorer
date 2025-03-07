import { getRequest } from '@/utility/generalServices'

export interface Provider {
  providerId: string
  totalFaultedPeriods: number
  totalDataSize: string
  proofSetIds: number[]
  blockNumber: number
  blockHash: string
  createdAt: string
  updatedAt: string
  activeProofSets: number
  numRoots: number
  firstSeen: string
  lastSeen: string
}

export interface ProviderDetailsResponse extends Provider {
  proofSets: ProofSet[]
}

export interface Activity {
  id: string
  type: string
  timestamp: string
  details: string
  value: number
}

export interface ProofSet {
  setId: number
  owner: string
  listenerAddr: string
  totalFaultedPeriods: number
  totalDataSize: string
  totalRoots: number
  totalProvedRoots: number
  totalFeePaid: string
  lastProvenEpoch: number
  nextChallengeEpoch: number
  isActive: boolean
  blockNumber: number
  blockHash: string
  createdAt: string
  updatedAt: string
  transactions?: Transaction[]
}

export interface Transaction {
  hash: string
  proofSetId: number
  messageId: string
  height: number
  fromAddress: string
  toAddress: string
  value: string
  method: string
  status: boolean
  blockNumber: number
  blockHash: string
  createdAt: string
}

export interface HeatmapEntry {
  date: string
  status: string
  rootPieceId: string
}

export interface ProviderActivitiesParams {
  providerId: string
  type: 'prove_possession' | 'fault_recorded'
  startDate?: string
  endDate?: string
}

export interface EventLog {
  eventName: string
  data: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  createdAt: string
}

export interface Roots {
  rootId: number
  cid: string
  size: number
  removed: boolean
  totalPeriodsFaulted: number
  totalProofsSubmitted: number
  lastProvenEpoch: number
  lastProvenAt: string | null
  lastFaultedEpoch: number
  lastFaultedAt: string | null
  createdAt: string
}

// Provider-related API calls
export async function getProviders(offset = 0, limit = 10, search = '') {
  const queryParams = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    ...(search && { q: search }),
  })
  const res = await getRequest(`/providers?${queryParams}`)
  return res.data
}

export const getProviderDetails = async (
  providerId: string
): Promise<ProviderDetailsResponse> => {
  const res = await getRequest(`/providers/${providerId}`)
  return res.data
}

export const getProviderActivities = async (
  params: ProviderActivitiesParams
): Promise<Activity[]> => {
  const queryParams = new URLSearchParams({
    type: params.type,
    ...(params.startDate && { startDate: params.startDate }),
    ...(params.endDate && { endDate: params.endDate }),
  })

  const res = await getRequest(
    `/providers/${params.providerId}/activities?${queryParams}`
  )
  return res.data
}

export const getProviderProofSets = async (
  providerId: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/providers/${providerId}/proof-sets?offset=${offset}&limit=${limit}`
  )
  return response.data
}

// ProofSet-related API calls
export async function getProofSets(
  sortBy: string = 'proofsSubmitted',
  order: string = 'desc',
  offset = 0,
  limit = 10,
  search = ''
) {
  const queryParams = new URLSearchParams({
    sortBy,
    order,
    offset: offset.toString(),
    limit: limit.toString(),
    ...(search && { q: search }),
  })
  const res = await getRequest(`/proofsets?${queryParams}`)
  return res.data
}

export const getProofSetDetails = async (proofSetId: string) => {
  const response = await getRequest(`/proofsets/${proofSetId}`)

  return {
    data: {
      proofSet: response.data,
    },
  }
}

export async function getProofSetHeatmap(proofSetId: string) {
  const res = await getRequest(`/proofsets/${proofSetId}/heatmap`)
  return res.data
}

export async function getNetworkMetrics() {
  const res = await getRequest('/network-metrics')
  return { data: res.data } // Wrap the response data to match the expected format
}

export const search = (query: string) => {
  return getRequest(`/search?q=${query}`)
}

export const getProofSetEventLogs = async (
  proofSetId: string,
  filter: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/proofsets/${proofSetId}/event-logs?offset=${offset}&limit=${limit}&filter=${filter}`
  )
  return {
    data: {
      eventLogs: response.data.data || [],
      metadata: response.data.metadata,
    },
  }
}

export const getProofSetTxs = async (
  proofSetId: string,
  filter: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/proofsets/${proofSetId}/txs?offset=${offset}&limit=${limit}&filter=${filter}`
  )
  return {
    data: {
      txs: response.data.data || [],
      metadata: response.data.metadata,
    },
  }
}

export const getProofSetRoots = async (
  proofSetId: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/proofsets/${proofSetId}/roots?offset=${offset}&limit=${limit}`
  )
  return {
    data: {
      roots: response.data.data || [],
      metadata: response.data.metadata,
    },
  }
}
