import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useValidatedDebounce } from '@/hooks/useValidatedDebounce'
import useGraphQL from '@/hooks/useGraphQL'
import { servicesQuery } from '@/utility/queries'
import type { Service } from '@/utility/types'
import { ServicesTable } from '@/components/Services/ServicesTable'
import { normalizeBytesFilter } from '@/utility/helper'

const ITEMS_PER_PAGE = 10

export const Services = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const { debouncedSearch, validatedSearch, searchError } =
    useValidatedDebounce(searchQuery, 300)

  const {
    data: servicesData,
    error: servicesError,
    isLoading: servicesLoading,
  } = useGraphQL<{
    services: Service[]
    networkMetric: { totalServices: string }
  }>(
    servicesQuery,
    {
      first: ITEMS_PER_PAGE,
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      where: validatedSearch
        ? { address_contains: normalizeBytesFilter(validatedSearch) }
        : {},
      orderBy: 'totalProofSets',
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  )

  const services = servicesData?.services || []
  const totalServices =
    services.length > 0
      ? parseInt(servicesData?.networkMetric?.totalServices || '0')
      : 0
  const totalPages = Math.max(1, Math.ceil(totalServices / ITEMS_PER_PAGE))

  // Reset page to 1 when search query changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1)
    }
  }, [validatedSearch])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Service Contracts</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Browse all service contracts in the PDP network
        </p>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by service address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${searchError ? 'border-red-500' : ''}`}
          />
        </div>
        {searchError && (
          <div className="text-red-500 text-sm mt-1 mb-4">{searchError}</div>
        )}

        {/* Services Table */}
        <ServicesTable
          services={services}
          isLoading={servicesLoading}
          error={servicesError}
          searchQuery={searchQuery}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Services
