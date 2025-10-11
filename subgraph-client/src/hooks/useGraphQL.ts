import useSWR from 'swr/immutable'
import { fetcher } from '@/utility/fetcher'
import { useNetwork } from '@/contexts/NetworkContext'

// A generic hook for GraphQL queries with SWR
export function useGraphQL<T>(
  query: string,
  variables?: Record<string, any>,
  options?: {
    revalidateOnFocus?: boolean
    errorRetryCount?: number
    errorRetryInterval?: number
    keepPreviousData?: boolean
  }
) {
  const { subgraphUrl } = useNetwork()
  const vars = variables

  const { data, error, isLoading, isValidating } = useSWR<T>(
    [subgraphUrl, query, vars],
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
