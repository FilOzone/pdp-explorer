import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getProviders,
  getProofSets,
  getNetworkMetrics,
  search,
} from '@/api/apiService'
import { useDebounce } from '@/hooks/useDebounce'

// Define interfaces based on backend types
interface Provider {
  providerId: string
  activeProofSets: number
  dataSizeStored: number
  numRoots: number
  firstSeen: string
  lastSeen: string
  faults: number
}

interface ProofSet {
  proofSetId: string
  status: boolean
  firstRoot: string
  numRoots: number
  createdAt: string
  lastProofReceived: string
}

interface NetworkMetrics {
  totalProofSets: number
  totalProviders: number
  totalDataSize: number
  totalPieces: number
  totalProofs: number
  totalFaults: number
  uniqueDataSize: number
  uniquePieces: number
}

interface SearchResult {
  type: 'provider' | 'proofset'
  id: string
  proofSetId: string
  activeSets: number
  dataSize: number
}

export const Landing = () => {
  // Update state types to match backend data structures
  const [providers, setProviders] = useState<Provider[]>([])
  const [proofSets, setProofSets] = useState<ProofSet[]>([])
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Add search effect
  useEffect(() => {
    if (debouncedSearch) {
      search(debouncedSearch).then((res) => {
        setSearchResults(res.data.results)
      })
    } else {
      setSearchResults([])
    }
  }, [debouncedSearch])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [providersRes, proofSetsRes, metricsRes] = await Promise.all([
          getProviders(0, 10),
          getProofSets('proofsSubmitted', 'desc', 0, 10),
          getNetworkMetrics(),
        ])

        setProviders(providersRes?.data || [])
        setProofSets(proofSetsRes?.data || [])
        setMetrics(metricsRes?.data || null)
      } catch (err) {
        console.error('Error fetching data:', err)
        setProviders([])
        setProofSets([])
        setMetrics(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Logo and Search */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold">PDP Explorer</h1>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search for a ProofSet/Provider"
            className="w-full p-2 border rounded-lg pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10">
              {searchResults.map((result, index) => (
                <Link
                  key={index}
                  to={
                    result.type === 'provider'
                      ? `/providers/${result.id}`
                      : `/proofsets/${result.proofSetId}`
                  }
                  className="flex items-center p-3 hover:bg-gray-100 border-b last:border-b-0"
                >
                  <span className="mr-2">
                    {result.type === 'provider' ? '🏢' : '📦'}
                  </span>
                  <div>
                    <p className="font-medium">
                      {result.type === 'provider'
                        ? result.id
                        : result.proofSetId}
                    </p>
                    <p className="text-sm text-gray-600">
                      {result.type === 'provider'
                        ? `${result.activeSets} active sets`
                        : `${(result.dataSize / 1024 ** 3).toFixed(2)} GB`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network Wide Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Network Wide Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total ProofSets"
            value={metrics?.totalProofSets || 0}
          />
          <MetricCard
            title="# of PDP Providers"
            value={metrics?.totalProviders || 0}
          />
          <MetricCard
            title="Total Data Size"
            value={`${((metrics?.totalDataSize || 0) / 1024 ** 5).toFixed(
              2
            )} PB`}
          />
          <MetricCard
            title="Total # of Data Pieces"
            value={metrics?.totalPieces || 0}
          />
          <MetricCard
            title="Total # of PDP proofs"
            value={metrics?.totalProofs || 0}
          />
          <MetricCard
            title="Total # of Faults"
            value={metrics?.totalFaults || 0}
          />
          <MetricCard
            title="Total Unique Data Size"
            value={`${((metrics?.uniqueDataSize || 0) / 1024 ** 5).toFixed(
              2
            )} PB`}
          />
          <MetricCard
            title="Total # of Unique Pieces"
            value={metrics?.uniquePieces || 0}
          />
        </div>
      </div>

      {/* Providers Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Providers</h2>
          <Link to="/providers" className="text-blue-500 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Provider</th>
                <th className="p-2 border">ProofSet#</th>
                <th className="p-2 border">Data Size</th>
                <th className="p-2 border">Joined Date</th>
                <th className="p-2 border">Last Seen</th>
                <th className="p-2 border">Fault #</th>
                <th className="p-2 border">Activity</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider, index) => (
                <tr key={provider.providerId}>
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">
                    <Link
                      to={`/providers/${provider.providerId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {provider.providerId}
                    </Link>
                  </td>
                  <td className="p-2 border">{provider.activeProofSets}</td>
                  <td className="p-2 border">
                    {(provider.dataSizeStored / 1024 / 1024 / 1024).toFixed(2)}{' '}
                    GB
                  </td>
                  <td className="p-2 border">
                    {new Date(provider.firstSeen).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {new Date(provider.lastSeen).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">{provider.numRoots}</td>
                  <td className="p-2 border">📈</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ProofSets Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">ProofSets</h2>
          <Link to="/proofsets" className="text-blue-500 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Proof Set ID</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Root #</th>
                <th className="p-2 border">Created At</th>
                <th className="p-2 border">Last Proof</th>
              </tr>
            </thead>
            <tbody>
              {proofSets.map((proofSet, index) => (
                <tr key={proofSet.proofSetId}>
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">
                    <Link
                      to={`/proofsets/${proofSet.proofSetId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {proofSet.proofSetId}
                    </Link>
                  </td>
                  <td className="p-2 border">
                    {proofSet.status ? 'Active' : 'Inactive'}
                  </td>
                  <td className="p-2 border">{proofSet.numRoots}</td>
                  <td className="p-2 border">
                    {new Date(proofSet.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {new Date(proofSet.lastProofReceived).toLocaleDateString()}
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

export const MetricCard = ({
  title,
  value,
}: {
  title: string
  value: React.ReactNode
}) => {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
