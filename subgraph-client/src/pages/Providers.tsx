import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/useDebounce'
import useGraphQL from '@/hooks/useGraphQL'
import { providerQuery, networkMetricsQuery } from '@/utility/queries'
import type { Provider, NetworkMetrics } from '@/utility/types'
import { ProvidersTable } from '@/components/Providers/ProvidersTable'
import { normalizeBytesFilter } from '@/utility/helper'

const ITEMS_PER_PAGE = 10

export const Providers = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const { data: metricsData, error: metricsError } = useGraphQL<{
    networkMetric: NetworkMetrics
  }>(
    networkMetricsQuery,
    undefined, // No variables needed
    { revalidateOnFocus: false } // Metrics don't change that often
  )

  const {
    data: providersData,
    error: providersError,
    isLoading: providersLoading,
  } = useGraphQL<{ providers: Provider[] }>(
    providerQuery,
    {
      first: ITEMS_PER_PAGE,
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      where: debouncedSearch
        ? { address_contains: normalizeBytesFilter(debouncedSearch) }
        : {},
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  )

  const providers = providersData?.providers || []
  const totalProviders = Number(metricsData?.networkMetric?.totalProviders || 0)

  // Reset page to 1 when search query changes
  // Note: useDebounce handles the delay, so we don't reset prematurely
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1)
    }
  }, [debouncedSearch]) // Effect depends on the debounced value

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Storage Providers</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="border rounded mb-4">
        {/* Error from metrics query doesn't prevent showing potentially loaded providers */}
        {metricsError && (
          <div className="p-2 text-xs text-red-600 bg-red-50 border-b">
            Could not load total provider count.
          </div>
        )}
        <ProvidersTable
          providers={providers}
          isLoading={providersLoading}
          error={providersError}
          searchQuery={debouncedSearch}
        />
      </div>
      {/* Pagination - Show if not searching or if search results exceed one page */}
      {/* We use totalProviders from metrics, assuming search doesn't affect total count drastically */}
      {/* A more accurate approach might require a separate count query for the search */}
      {totalProviders > ITEMS_PER_PAGE && !metricsError && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalProviders / ITEMS_PER_PAGE)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  )
}
