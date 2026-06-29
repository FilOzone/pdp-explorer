import useSWR from 'swr/immutable'
import { fetcher } from '@/utility/fetcher'
import { useNetwork } from '@/contexts/NetworkContext'

// A generic hook for GraphQL queries with SWR
export function useGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: {
    enabled?: boolean
    revalidateOnFocus?: boolean
    errorRetryCount?: number
    errorRetryInterval?: number
    keepPreviousData?: boolean
  }
) {
  const { subgraphUrl } = useNetwork()
  const vars = variables
  // When disabled (e.g. no valid id), use a null key so SWR skips the request
  const enabled = options?.enabled ?? true

  const { data, error, isLoading, isValidating } = useSWR<T>(
    enabled ? [subgraphUrl, query, vars] : null,
    fetcher,
    {
      revalidateOnFocus: options?.revalidateOnFocus,
      errorRetryCount: options?.errorRetryCount,
      errorRetryInterval: options?.errorRetryInterval,
    }
  )

  return { data, error, isLoading, isValidating }
}

export default useGraphQL
