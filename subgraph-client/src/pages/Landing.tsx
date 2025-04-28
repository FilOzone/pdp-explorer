import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Github, FileCode, Search } from 'lucide-react'
import { search, SearchResult } from '@/api/apiService'
import { formatDataSize } from '@/utility/helper'
import { networkContractAddresses, explorerUrls } from '@/utility/constants'
import useGraphQL from '@/hooks/useGraphQL'
import { landingDataQuery } from '@/utility/queries'
import type { NetworkMetrics, Provider, ProofSet } from '@/utility/types'
import { NetworkStatsCard } from '@/components/Landing/NetworkStatsCard'
import { RecentProofSetsTable } from '@/components/Landing/RecentProofSetsTable'
import { RecentProvidersTable } from '@/components/Landing/RecentProvidersTable'
import { NetworkSelector } from '@/components/shared/NetworkSelector'
import { useNetwork } from '@/contexts/NetworkContext'
// import { ModeToggle } from '@/components/shared/ThemeToggle'

const ITEMS_PER_PAGE = 10 // How many recent items to show

export const Landing = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const { subgraphUrl, network } = useNetwork()

  const {
    data: landingData,
    error: landingDataError,
    isLoading: landingDataLoading,
  } = useGraphQL<{
    networkMetric: NetworkMetrics
    providers: Provider[]
    proofSets: ProofSet[]
  }>(
    landingDataQuery,
    {
      first: ITEMS_PER_PAGE,
      skip: 0,
      orderDirection: 'desc',
    },
    { revalidateOnFocus: false, errorRetryCount: 2 }
  )

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await search(subgraphUrl, searchQuery.trim())
      const results = response

      if (results.length === 1) {
        const path =
          results[0].type === 'provider'
            ? `/providers/${results[0].id}`
            : `/proofsets/${results[0].id}`
        navigate(path)
      } else if (results.length > 1) {
        setSearchResults(results)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    }
  }

  const metrics = landingData?.networkMetric
  const providers = landingData?.providers || []
  const proofSets = landingData?.proofSets || []

  const contractAddresses = networkContractAddresses[network]
  const explorerUrl = explorerUrls[network]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        {/* Adjusted header for title, network selector and theme toggle */}
        <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-md">
              <FileCode className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              PDP Scan
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/FilOzone/pdp-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              aria-label="GitHub Repository"
            >
              <Github className="h-5 w-5" />
            </a>
            {/* Network Selector */}
            <NetworkSelector />
            {/* TODO: Fix colors to add this toggle ( default theme is light) */}
            {/* <ModeToggle />  */}
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search by ProofSet ID or Provider ID"
            className="w-full p-2 border rounded-lg pl-10"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) {
                setSearchResults([]) // Clear results when input is cleared
              }
            }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-900"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  to={
                    result.type === 'provider'
                      ? `/providers/${result.id}`
                      : `/proofsets/${result.id}`
                  }
                  className="block p-3 hover:bg-gray-100 border-b last:border-b-0"
                  onClick={() => setSearchResults([])} // Close dropdown on click
                >
                  <p className="font-medium truncate">
                    <span className="text-xs uppercase bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 mr-2">
                      {result.type}
                    </span>
                    {result.id}
                  </p>
                  {/* Additional info if available in search result */}
                  {(result.active_sets !== undefined ||
                    result.data_size !== undefined) && (
                    <p className="text-sm text-gray-600 mt-1">
                      {result.type === 'provider'
                        ? `${result.active_sets} active sets`
                        : `${formatDataSize(result.data_size)}`}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Network Wide Metrics Section */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Network Overview</h2>
        <NetworkStatsCard
          metrics={metrics}
          isLoading={landingDataLoading}
          error={landingDataError}
        />
      </div>

      {/* Recent Proof Sets and Providers Sections */}
      <div className="flex flex-col gap-8">
        {/* Recent Providers */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Providers</h2>
            <Link
              to="/providers"
              className="text-blue-500 hover:underline text-sm"
            >
              View All
            </Link>
          </div>
          <div className="border rounded">
            <RecentProvidersTable
              providers={providers}
              isLoading={landingDataLoading}
              error={landingDataError}
              itemsToShow={ITEMS_PER_PAGE}
            />
          </div>
        </div>

        {/* Recent Proof Sets */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Proof Sets</h2>
            <Link
              to="/proofsets"
              className="text-blue-500 hover:underline text-sm"
            >
              View All
            </Link>
          </div>
          <div className="border rounded">
            <RecentProofSetsTable
              proofSets={proofSets}
              isLoading={landingDataLoading}
              error={landingDataError}
              itemsToShow={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 py-12 bg-muted/50 rounded-lg">
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
                <h3 className="font-medium">PDP Scan</h3>
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
