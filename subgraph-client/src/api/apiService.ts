import { fetcher } from '@/utility/fetcher'
import { providerQuery, landingProofSetsQuery } from '@/utility/queries'
import type { Provider, ProofSet } from '@/utility/types'
import { normalizeBytesFilter } from '@/utility/helper'

export interface SearchResult {
  type: 'provider' | 'proofset'
  id: string
  provider_id?: string
  active_sets?: number
  data_size: string
}

// Regex to validate hex strings (optional 0x prefix)
const hexRegex = /^(0x)?[0-9a-fA-F]+$/

export const search = async (query: string): Promise<SearchResult[]> => {
  const trimmedQuery = query.trim()

  if (!hexRegex.test(trimmedQuery)) {
    console.log('Search query is not a valid hex string:', trimmedQuery)
    return []
  }

  try {
    const providers = await fetcher<{ providers: Provider[] }>([
      providerQuery,
      { where: { address_contains: normalizeBytesFilter(trimmedQuery) } },
    ])
    const proofSets = isNaN(Number(trimmedQuery))
      ? { proofSets: [] }
      : await fetcher<{ proofSets: ProofSet[] }>([
          landingProofSetsQuery,
          { where: { setId: trimmedQuery } },
        ])

    const searchResults: SearchResult[] = []

    if (providers?.providers?.length > 0) {
      searchResults.push(
        ...providers.providers.map((provider) => ({
          type: 'provider' as const,
          id: provider.address,
          provider_id: provider.address,
          active_sets: Number(provider.totalProofSets),
          data_size: provider.totalDataSize,
        }))
      )
    }

    if (proofSets?.proofSets?.length > 0) {
      searchResults.push(
        ...proofSets.proofSets.map((proofSet) => ({
          type: 'proofset' as const,
          id: proofSet.setId,
          provider_id: proofSet.owner.address,
          data_size: proofSet.totalDataSize,
        }))
      )
    }

    return searchResults
  } catch (err) {
    console.error('Search failed:', err)
    return []
  }
}
