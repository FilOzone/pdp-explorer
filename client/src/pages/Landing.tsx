import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Github,
  FileCode,
  Search,
  Database,
  Shield,
  ChevronRight,
  Clock,
  Hash,
  HardDrive,
  Activity,
} from 'lucide-react'
import {
  getProviders,
  getProofSets,
  getNetworkMetrics,
  search,
} from '@/api/apiService'
import { Pagination } from '@/components/ui/pagination'
import { formatDate, formatDataSize } from '@/utility/helper'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Hero Section with Search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-4">
              PDP Explorer
            </h1>
            <p className="text-gray-600">
              Explore and verify Provable Data Possession on the network
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ProofSet ID or Provider ID..."
                className="w-full p-3 pl-12 pr-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-lg mt-2 z-10 border border-gray-200">
                {searchResults.map((result, index) => (
                  <Link
                    key={index}
                    to={
                      result.type === 'provider'
                        ? `/providers/${result.id}`
                        : `/proofsets/${result.id}`
                    }
                    className="flex items-center p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="mr-4 p-2 rounded-full bg-gray-50">
                      {result.type === 'provider' ? (
                        <Shield className="h-6 w-6 text-blue-500" />
                      ) : (
                        <Database className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">
                          {result.type === 'provider' ? 'Provider' : 'ProofSet'}
                        </span>
                        <span className="font-medium text-gray-900">
                          {result.id}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {result.type === 'provider'
                          ? `${result.active_sets} active sets`
                          : `${formatDataSize(result.data_size)}`}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            Network Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total ProofSets"
              value={metrics?.totalProofSets ?? 0}
              icon={<Hash className="h-5 w-5" />}
              change={null}
              period="24h"
            />
            <MetricCard
              title="Active Providers"
              value={metrics?.totalProviders ?? 0}
              icon={<Shield className="h-5 w-5" />}
              change={null}
              period="24h"
            />
            <MetricCard
              title="Total Data Size"
              value={metrics ? formatDataSize(metrics.totalDataSize) : '0 GB'}
              icon={<HardDrive className="h-5 w-5" />}
              change={null}
              period="24h"
            />
            <MetricCard
              title="Total Proofs"
              value={metrics?.totalProofs ?? 0}
              icon={<Activity className="h-5 w-5" />}
              change={null}
              period="24h"
            />
          </div>
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-gray-900">
              Latest Providers
            </h2>
            <Link
              to="/providers"
              className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      ProofSets
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Data Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Faults
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {providers.map((provider) => (
                    <tr
                      key={provider.providerId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/providers/${provider.providerId}`}
                          className="text-blue-500 hover:text-blue-600 font-medium"
                        >
                          {provider.providerId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {provider.activeProofSets}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {formatDataSize(provider.totalDataSize)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                          {formatDate(provider.firstSeen, false)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                          {formatDate(provider.lastSeen, false)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800">
                          {provider.totalFaultedPeriods}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalProviders > ITEMS_PER_PAGE && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Pagination
                  currentPage={providerPage}
                  totalPages={Math.ceil(totalProviders / ITEMS_PER_PAGE)}
                  onPageChange={setProviderPage}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-medium text-gray-900">
              Latest ProofSets
            </h2>
            <Link
              to="/proofsets"
              className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      ProofSet ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Roots
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Proofs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {proofSets.map((proofSet) => (
                    <tr
                      key={proofSet.setId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/proofsets/${proofSet.setId}`}
                          className="text-blue-500 hover:text-blue-600 font-medium"
                        >
                          {proofSet.setId}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            proofSet.isActive
                              ? 'bg-green-50 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {proofSet.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {proofSet.totalRoots}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {proofSet.totalProvedRoots.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                          {formatDate(proofSet.createdAt, false)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalProofSets > ITEMS_PER_PAGE && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Pagination
                  currentPage={proofSetPage}
                  totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
                  onPageChange={setProofSetPage}
                />
              </div>
            )}
          </div>
        </div>

        {/* Resources Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-medium text-gray-900 mb-2">
                Explore Our Resources
              </h2>
              <p className="text-gray-600">
                Dive deeper into our codebase and smart contracts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ResourceCard
                title="PDPVerifier Contract"
                description="View contract details and transactions"
                icon={<FileCode className="h-5 w-5" />}
                href={`${explorerUrl}/address/${contractAddresses.PDPVerifier}`}
              />
              <ResourceCard
                title="SimplePDPService"
                description="Explore the service contract"
                icon={<FileCode className="h-5 w-5" />}
                href={`${explorerUrl}/address/${contractAddresses.SimplePDPService}`}
              />
              <ResourceCard
                title="PDP Repository"
                description="Check out our core implementation"
                icon={<Github className="h-5 w-5" />}
                href="https://github.com/FilOzone/pdp"
              />
              <ResourceCard
                title="PDP Explorer"
                description="Contribute to this explorer"
                icon={<Github className="h-5 w-5" />}
                href="https://github.com/FilOzone/pdp-explorer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced MetricCard component
const MetricCard = ({
  title,
  value,
  icon,
  change,
  period,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  change: string | null
  period: string
}) => {
  const isPositive = change?.startsWith('+')
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center text-gray-500">
          {icon}
          <span className="ml-2 text-sm font-medium">{title}</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        {change && (
          <div className="mt-2 flex items-center text-sm">
            <span
              className={`font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change}
            </span>
            <span className="text-gray-500 ml-1">in last {period}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Enhanced ResourceCard component
const ResourceCard = ({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"
    >
      <div className="flex items-center mb-3">
        <div className="text-gray-500 group-hover:text-blue-500 transition-colors">
          {icon}
        </div>
        <h3 className="ml-3 font-medium text-gray-900 group-hover:text-blue-500 transition-colors">
          {title}
        </h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </a>
  )
}
