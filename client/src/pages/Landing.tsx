import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Github, FileCode } from 'lucide-react'
import {
  getProviders,
  getProofSets,
  getNetworkMetrics,
  search,
} from '@/api/apiService'
import { Pagination } from '@/components/ui/pagination'
import { formatDate } from '@/utility/helper'
import { explorerUrl, contractAddresses } from '@/utility/constants'

interface Provider {
  providerId: string
  totalFaultedPeriods: number
  totalDataSize: string
  proofSetIds: number[]
  blockNumber: number
  blockHash: string
  createdAt: string
  updatedAt: string
  activeProofSets: number
  numRoots: number
  firstSeen: string
  lastSeen: string
}

interface ProofSet {
  setId: number
  owner: string
  listenerAddr: string
  totalFaultedPeriods: number
  totalDataSize: string
  totalRoots: number
  totalProvedRoots: number
  totalFeePaid: string
  lastProvenEpoch: number
  nextChallengeEpoch: number
  isActive: boolean
  blockNumber: number
  blockHash: string
  createdAt: string
  updatedAt: string
  proofsSubmitted: number
  faults: number
}

interface NetworkMetrics {
  totalProofSets: number
  totalProviders: number
  totalDataSize: string
  totalPieces: number
  totalProofs: number
  totalFaults: number
  uniqueDataSize: string
  uniquePieces: number
}

interface SearchResult {
  type: 'provider' | 'proofset'
  id: string
  provider_id?: string
  active_sets?: number
  data_size: string
}

export const Landing = () => {
  const [providers, setProviders] = useState<Provider[]>([])
  const [proofSets, setProofSets] = useState<ProofSet[]>([])
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [providerPage, setProviderPage] = useState(1)
  const [proofSetPage, setProofSetPage] = useState(1)
  const [totalProviders, setTotalProviders] = useState(0)
  const [totalProofSets, setTotalProofSets] = useState(0)
  const ITEMS_PER_PAGE = 10

  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    try {
      const response = await search(searchQuery.trim())
      const results = response.data.results

      if (results.length === 1) {
        // Direct redirect if exact match
        const result = results[0]
        if (result.type === 'provider') {
          navigate(`/providers/${result.id}`)
        } else {
          navigate(`/proofsets/${result.id}`)
        }
      } else if (results.length > 1) {
        setSearchResults(results)
      } else {
        // No results found
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [providersRes, proofSetsRes, metricsRes] = await Promise.all([
          getProviders((providerPage - 1) * ITEMS_PER_PAGE, ITEMS_PER_PAGE),
          getProofSets(
            'proofsSubmitted',
            'desc',
            (proofSetPage - 1) * ITEMS_PER_PAGE,
            ITEMS_PER_PAGE
          ),
          getNetworkMetrics(),
        ])

        if (providersRes?.data) {
          setProviders(providersRes.data)
          setTotalProviders(providersRes.metadata?.total || 0)
        }

        if (proofSetsRes?.data) {
          setProofSets(proofSetsRes.data)
          setTotalProofSets(proofSetsRes.metadata?.total || 0)
        }

        if (metricsRes?.data) {
          setMetrics(metricsRes.data)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setProviders([])
        setProofSets([])
        setMetrics(null)
        setTotalProviders(0)
        setTotalProofSets(0)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providerPage, proofSetPage])

  useEffect(() => {
    console.log('Current metrics state:', metrics)
  }, [metrics])

  const formatDataSize = (sizeInBytes: string) => {
    const bytes = BigInt(sizeInBytes)
    const gigabytes = Number(bytes) / 1024 ** 3
    return `${gigabytes.toFixed(2)} GB`
  }
  console.log(proofSets)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold">PDP Explorer</h1>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search by ProofSet ID or Provider ID"
            className="w-full p-2 border rounded-lg pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2"
          >
            🔍
          </button>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10">
              {searchResults.map((result, index) => (
                <Link
                  key={index}
                  to={
                    result.type === 'provider'
                      ? `/providers/${result.id}`
                      : `/proofsets/${result.id}`
                  }
                  className="flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">
                      {result.type === 'provider' ? 'Provider: ' : 'ProofSet: '}
                      {result.id}
                    </p>
                    <p className="text-sm text-gray-600">
                      {result.type === 'provider'
                        ? `${result.active_sets} active sets`
                        : `${formatDataSize(result.data_size)}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Network Wide Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Network Wide Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total ProofSets"
            value={metrics?.totalProofSets ?? 0}
          />
          <MetricCard
            title="# of PDP Providers"
            value={metrics?.totalProviders ?? 0}
          />
          <MetricCard
            title="Total Data Size"
            value={metrics ? formatDataSize(metrics.totalDataSize) : '0 GB'}
          />
          <MetricCard
            title="Total # of Data Pieces"
            value={metrics?.totalPieces ?? 0}
          />
          <MetricCard
            title="Total # of PDP proofs"
            value={metrics?.totalProofs ?? 0}
          />
          <MetricCard
            title="Total # of Faults"
            value={metrics?.totalFaults ?? 0}
          />
          <MetricCard
            title="Total Unique Data Size"
            value={metrics ? formatDataSize(metrics.uniqueDataSize) : '0 GB'}
          />
          <MetricCard
            title="Total # of Unique Pieces"
            value={metrics?.uniquePieces ?? 0}
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
        <div className="overflow-x-auto border rounded">
          {providers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No providers found
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Provider</th>
                  <th className="p-2 border">ProofSet#</th>
                  <th className="p-2 border">Data Size</th>
                  <th className="p-2 border">Joined Date</th>
                  <th className="p-2 border">Last Seen</th>
                  <th className="p-2 border">Fault #</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider, index) => (
                  <tr key={provider.providerId} className="hover:bg-gray-50">
                    <td className="p-2 border">
                      {(providerPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
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
                      {(Number(provider.totalDataSize) / 1024 ** 3).toFixed(2)}{' '}
                      GB
                    </td>
                    <td className="p-2 border">
                      {formatDate(provider.firstSeen, false)}
                    </td>
                    <td className="p-2 border">
                      {formatDate(provider.lastSeen, false)}
                    </td>
                    <td className="p-2 border">
                      {provider.totalFaultedPeriods}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalProviders > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={providerPage}
            totalPages={Math.ceil(totalProviders / ITEMS_PER_PAGE)}
            onPageChange={setProviderPage}
          />
        )}
      </div>

      {/* ProofSets Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">ProofSets</h2>
          <Link to="/proofsets" className="text-blue-500 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto border rounded">
          {proofSets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No proof sets found
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Proof Set ID</th>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Root #</th>
                  <th className="p-2 border"># of proofs</th>
                  <th className="p-2 border">Created At</th>
                </tr>
              </thead>
              <tbody>
                {proofSets.map((proofSet, index) => (
                  <tr key={proofSet.setId} className="hover:bg-gray-50">
                    <td className="p-2 border">
                      {(proofSetPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="p-2 border">
                      <Link
                        to={`/proofsets/${proofSet.setId}`}
                        className="text-blue-500 hover:underline"
                      >
                        {proofSet.setId}
                      </Link>
                    </td>
                    <td className="p-2 border">
                      {proofSet.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="p-2 border">{proofSet.totalRoots}</td>
                    <td className="p-2 border">
                      {proofSet.totalProvedRoots.toLocaleString()}
                    </td>
                    <td className="p-2 border">
                      {formatDate(proofSet.createdAt, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalProofSets > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={proofSetPage}
            totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
            onPageChange={setProofSetPage}
          />
        )}
      </div>

      <div className="mt-16 py-12 bg-muted/50 rounded-lg">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Want to Learn More?</h2>
            <p className="text-muted-foreground">
              Explore our codebase and smart contracts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <a
              href={`${explorerUrl}/address/${contractAddresses.PDPVerifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">PDPVerifier Contract</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                View contract details and transactions on Filfox
              </p>
            </a>

            <a
              href={`${explorerUrl}/address/${contractAddresses.SimplePDPService}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">SimplePDPService Contract</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Explore the service contract on Filfox
              </p>
            </a>

            <a
              href="https://github.com/FilOzone/pdp"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <Github className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">PDP Repository</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Check out our core PDP implementation
              </p>
            </a>

            <a
              href="https://github.com/FilOzone/pdp-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <Github className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">PDP Explorer</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Contribute to this explorer application
              </p>
            </a>
          </div>
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
