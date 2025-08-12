import { fetcher } from '@/utility/fetcher'
import { providerAndProofSetQuery } from '@/utility/queries'
import type { Provider, DataSet, Root } from '@/utility/types'
import { normalizeBytesFilter, parseRootCidToHex } from '@/utility/helper'
import type { Toast, ToasterToast } from '@/hooks/use-toast'

export interface SearchResult {
  type: 'provider' | 'proofset' | 'root'
  id: string
  provider_id?: string
  active_sets?: number
  data_size: string
  total_roots?: number
}

// Regex to validate hex strings (optional 0x prefix)
const hexRegex = /^(0x)?[0-9a-fA-F]+$/

export const search = async (
  subgraphUrl: string,
  query: string,
  toast?: ({ ...props }: Toast) => {
    id: string
    dismiss: () => void
    update: (props: ToasterToast) => void
  }
): Promise<SearchResult[]> => {
  const trimmedQuery = query.trim()

  try {
    const cid = parseRootCidToHex(trimmedQuery)
    const isProofSet = !isNaN(Number(trimmedQuery))
    const isProvider = hexRegex.test(trimmedQuery)

    if (!isProvider && !isProofSet && !cid) {
      toast?.({
        title: 'Search failed',
        description: 'Invalid search query',
        variant: 'destructive',
      })
      return []
    }
    const providerAndProofSet = await fetcher<{
      providers: Provider[]
      dataSets: DataSet[]
      roots: Root[]
    }>([
      subgraphUrl,
      providerAndProofSetQuery,
      {
        where_provider: isProvider
          ? {
              address_contains: normalizeBytesFilter(trimmedQuery),
            }
          : { address: null },
        where_proofset: { setId: isProofSet ? trimmedQuery : null },
        where_root: { cid: cid ? cid : null },
      },
    ])

    const searchResults: SearchResult[] = []

    if (providerAndProofSet?.providers?.length > 0) {
      searchResults.push(
        ...providerAndProofSet.providers.map((provider) => ({
          type: 'provider' as const,
          id: provider.address,
          provider_id: provider.address,
          active_sets: Number(provider.totalProofSets),
          data_size: provider.totalDataSize,
        }))
      )
    }

    if (providerAndProofSet?.dataSets?.length > 0) {
      searchResults.push(
        ...providerAndProofSet.dataSets.map((proofSet) => ({
          type: 'proofset' as const,
          id: proofSet.setId,
          provider_id: proofSet.owner.address,
          data_size: proofSet.totalDataSize,
        }))
      )
    }

    const uniqueProofSetIds = new Set()
    if (providerAndProofSet?.roots?.length > 0) {
      searchResults.push(
        ...providerAndProofSet.roots
          .filter((root) => {
            if (!uniqueProofSetIds.has(root?.proofSet?.setId)) {
              uniqueProofSetIds.add(root?.proofSet?.setId)
              return true
            }
            return false
          })
          .map((root) => ({
            type: 'root' as const,
            id: root?.proofSet?.setId,
            provider_id: root?.proofSet?.owner?.address,
            data_size: root.rawSize,
            total_roots: Number(root?.proofSet?.totalRoots),
          }))
      )
    }

    return searchResults
  } catch (err) {
    console.error('Search failed:', err)
    return []
  }
}
