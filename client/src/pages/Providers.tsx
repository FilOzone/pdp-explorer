import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProviders, Provider } from '@/api/apiService'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export const Providers = () => {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getProviders()
        // Extract the data array from the paginated response
        setProviders(response.data || [])
      } catch (error) {
        console.error('Error fetching providers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>

  const formatDataSize = (size: string) => {
    if (!size || size === '0') return 'NaN GB'
    return `${(Number(size) / 1024 ** 3).toFixed(2)} GB`
  }

  const filteredProviders = providers.filter((provider) =>
    provider.providerId.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                <th className="text-left p-4 font-medium">Proof Sets</th>
                <th className="text-left p-4 font-medium">Total Roots</th>
                <th className="text-left p-4 font-medium">Faults</th>
                <th className="text-left p-4 font-medium">First Seen</th>
                <th className="text-left p-4 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((provider) => (
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
                  <td className="p-4">
                    {new Date(provider.firstSeen).toLocaleString()}
                  </td>
                  <td className="p-4">
                    {new Date(provider.lastSeen).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
