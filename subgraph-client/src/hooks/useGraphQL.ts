import useSWRImmutable from 'swr/immutable'
import { fetcher } from '@/utility/fetcher'

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
  // Sanitize variables as needed (e.g. trim strings)
  const vars = variables

  const { data, error, isLoading, isValidating } = useSWRImmutable<T>(
    [query, vars],
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
