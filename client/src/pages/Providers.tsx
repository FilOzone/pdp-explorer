import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProviders, Provider } from '@/api/apiService'
import { Input } from '@/components/ui/input'
import { Search, HardDrive, Database, AlertTriangle, Clock } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatDataSize } from '@/utility/helper'

export const Providers = () => {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProviders, setTotalProviders] = useState(0)
  const ITEMS_PER_PAGE = 10

  const debouncedSearch = useDebounce(searchQuery, 300)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [debouncedSearch])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getProviders(
          (currentPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE,
          debouncedSearch
        )
        setProviders(response.data || [])
        setTotalProviders(response.metadata.total)
      } catch (error) {
        console.error('Error fetching providers:', error)
        setProviders([])
        setTotalProviders(0)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentPage, debouncedSearch])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Storage Providers
            </h1>
            <p className="text-gray-500 mt-1">
              Browse and search through all storage providers
            </p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by provider ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Provider ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" />
                    Data Size
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Proof Sets
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Total Roots
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Faults
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    First Seen
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {providers.map((provider) => (
                <tr
                  key={provider.providerId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link
                      to={`/providers/${provider.providerId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {provider.providerId}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        provider.activeProofSets > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {provider.activeProofSets > 0 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {formatDataSize(provider.totalDataSize)}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {provider.proofSetIds.length}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {provider.numRoots}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        provider.totalFaultedPeriods > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {provider.totalFaultedPeriods}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {formatDate(provider.firstSeen)}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {formatDate(provider.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {providers.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No providers found</p>
          </div>
        )}
        {totalProviders > ITEMS_PER_PAGE && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalProviders / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
