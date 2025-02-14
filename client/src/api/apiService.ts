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

// Provider-related API calls
export async function getProviders(offset = 0, limit = 10) {
  const res = await getRequest(`/providers?offset=${offset}&limit=${limit}`)
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

export const getProviderProofSets = async (providerId: string) => {
  const response = await getRequest(`/providers/${providerId}/proof-sets`)
  return response.data.data // Extract the data array from paginated response
}

// ProofSet-related API calls
export async function getProofSets(
  sortBy: string = 'proofsSubmitted',
  order: string = 'desc',
  offset = 0,
  limit = 10
) {
  const res = await getRequest(
    `/proofsets?sortBy=${sortBy}&order=${order}&offset=${offset}&limit=${limit}`
  )
  return res.data
}

export async function getProofSetDetails(
  proofSetId: string,
  txFilter: string = 'all'
) {
  const res = await getRequest(`/proofsets/${proofSetId}?txFilter=${txFilter}`)
  return res.data
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
