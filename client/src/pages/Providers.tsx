import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProviders, Provider } from '@/api/apiService'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
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
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Storage Providers</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="border rounded">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium">Provider ID</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Data Size</th>
                <th className="text-left p-4 font-medium">Data Sets</th>
                <th className="text-left p-4 font-medium">Total Pieces</th>
                <th className="text-left p-4 font-medium">Faults</th>
                <th className="text-left p-4 font-medium">First Seen</th>
                <th className="text-left p-4 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr
                  key={provider.providerId}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="p-4">
                    <Link
                      to={`/providers/${provider.providerId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {provider.providerId}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        provider.activeProofSets > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {provider.activeProofSets > 0 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    {formatDataSize(provider.totalDataSize)}
                  </td>
                  <td className="p-4">{provider.proofSetIds.length}</td>
                  <td className="p-4">{provider.numRoots}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        provider.totalFaultedPeriods > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {provider.totalFaultedPeriods}
                    </span>
                  </td>
                  <td className="p-4">{formatDate(provider.firstSeen)}</td>
                  <td className="p-4">{formatDate(provider.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalProviders > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalProviders / ITEMS_PER_PAGE)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}
