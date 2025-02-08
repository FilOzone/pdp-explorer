import { getRequest } from '@/utility/generalServices'

export async function getProviders(offset = 0, limit = 10) {
  const res = await getRequest(`/providers?offset=${offset}&limit=${limit}`)
  return res.data
}

export async function getProviderDetails(providerId: string) {
  const res = await getRequest(`/providers/${providerId}`)
  console.log(res)
  return res.data
}

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
