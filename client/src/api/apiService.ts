import { getRequest } from '@/utility/generalServices'

// Types
export interface Provider {
  id: string
  activeProofSets: number
  totalProofSets: number
  dataSizeStored: number
  totalPiecesStored: number
  faults: number
  firstSeen: string
  lastSeen: string
  activities: Activity[]
  proofSets: ProofSet[]
}

// Add a separate interface for ProviderDetailsPage
export interface ProviderDetailsResponse {
  providerId: string
  activeProofSets: number
  allProofSets: number
  dataSizeStored: number
  totalPiecesStored: number
  faults: number
  firstSeen: string
  lastSeen: string
  proofSets: Array<{
    proofSetId: string
    status: boolean
    firstRoot: string
    numRoots: number
    createdAt: string
    lastProofReceived: string
  }>
}

export interface Activity {
  timestamp: string
  value: number
}

export interface ProofSet {
  proofSetId: string
  status: boolean
  firstRoot: string
  numRoots: number
  createdAt: string
  lastProofReceived: string
}

export interface ProviderActivitiesParams {
  providerId: string
  type: 'onboarding' | 'faults'
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
  return res.data
}

export const search = (query: string) => {
  return getRequest(`/search?q=${query}`)
}
