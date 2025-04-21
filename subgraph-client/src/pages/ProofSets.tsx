import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/useDebounce'
import useGraphQL from '@/hooks/useGraphQL'
import { networkMetricsQuery, landingProofSetsQuery } from '@/utility/queries'
import type { ProofSet, NetworkMetrics } from '@/utility/types'
import { ProofSetsTable } from '@/components/ProofSets/ProofSetsTable'

const ITEMS_PER_PAGE = 10

export const ProofSets = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const { data: metricsData, error: metricsError } = useGraphQL<{
    networkMetric: NetworkMetrics
  }>(networkMetricsQuery, undefined, { revalidateOnFocus: false })

  const {
    data: proofSetsData,
    error: proofSetsError,
    isLoading: proofSetsLoading,
  } = useGraphQL<{ proofSets: ProofSet[] }>(
    landingProofSetsQuery,
    {
      first: ITEMS_PER_PAGE,
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      where: debouncedSearch ? { setId: debouncedSearch } : {},
      orderBy: 'createdAt',
      orderDirection: 'desc',
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  )

  const proofSets = proofSetsData?.proofSets || []
  const totalProofSets =
    Number(metricsData?.networkMetric?.totalProofSets || 0) || 0

  // Reset page to 1 when search query changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1)
    }
  }, [debouncedSearch])

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Proof Sets</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search by ID or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="border rounded mb-4">
        {metricsError && (
          <div className="p-2 text-xs text-red-600 bg-red-50 border-b">
            Could not load total proof set count.
          </div>
        )}
        <ProofSetsTable
          proofSets={proofSets}
          isLoading={proofSetsLoading}
          error={proofSetsError}
          searchQuery={debouncedSearch}
        />
      </div>
      {totalProofSets > ITEMS_PER_PAGE && !metricsError && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  )
}
