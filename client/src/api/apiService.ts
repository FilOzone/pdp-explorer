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
  proofsSubmitted: number
  faults: number
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
  type: 'proof_set_created' | 'fault_recorded'
  startDate?: string
  endDate?: string
}

export interface EventLog {
  id: string
  eventName: string
  data: string
  blockNumber: number
  transactionHash: string
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

export const getProofSetDetails = async (
  proofSetId: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/proofsets/${proofSetId}?offset=${offset}&limit=${limit}`
  )
  const proofSetDetails = response.data.data
  return {
    data: {
      proofSet: {
        setId: proofSetDetails.setId,
        owner: proofSetDetails.owner,
        listenerAddr: proofSetDetails.listenerAddr,
        totalFaultedPeriods: proofSetDetails.totalFaultedPeriods,
        totalDataSize: proofSetDetails.totalDataSize,
        totalRoots: proofSetDetails.totalRoots,
        totalProvedRoots: proofSetDetails.totalProvedRoots,
        totalFeePaid: proofSetDetails.totalFeePaid,
        lastProvenEpoch: proofSetDetails.lastProvenEpoch,
        nextChallengeEpoch: proofSetDetails.nextChallengeEpoch,
        isActive: proofSetDetails.isActive,
        blockNumber: proofSetDetails.blockNumber,
        blockHash: proofSetDetails.blockHash,
        createdAt: proofSetDetails.createdAt,
        updatedAt: proofSetDetails.updatedAt,
        proofsSubmitted: proofSetDetails.proofsSubmitted,
        faults: proofSetDetails.faults,
      },
      transactions: proofSetDetails.transactions || [],
      metadata: response.data.metadata,
    },
  }
}

export async function getProofSetHeatmap(proofSetId: string) {
  const res = await getRequest(`/proofsets/${proofSetId}/heatmap`)
  return res.data
}

export async function getNetworkMetrics() {
  const res = await getRequest('/network-metrics')
  console.log('Network metrics data:', res.data)
  return { data: res.data } // Wrap the response data to match the expected format
}

export const search = (query: string) => {
  return getRequest(`/search?q=${query}`)
}

export const getProofSetEventLogs = async (
  proofSetId: string,
  offset: number = 0,
  limit: number = 10
) => {
  const response = await getRequest(
    `/proofsets/${proofSetId}/event-logs?offset=${offset}&limit=${limit}`
  )
  return {
    data: {
      eventLogs: response.data.data || [],
      metadata: response.data.metadata,
    },
  }
}
