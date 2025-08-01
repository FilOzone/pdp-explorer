import React from 'react'
import { Link } from 'react-router-dom'
import { Provider } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatDataSize } from '@/utility/helper'

interface ProvidersTableProps {
  providers: Provider[]
  isLoading: boolean
  error: any
  searchQuery: string
}

export const ProvidersTable: React.FC<ProvidersTableProps> = ({
  providers,
  isLoading,
  error,
  searchQuery,
}) => {
  if (isLoading) {
    return <ProvidersTableSkeleton itemsPerPage={10} />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Providers</AlertTitle>
        <AlertDescription>
          Could not load providers list. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No providers found{searchQuery ? ` matching "${searchQuery}"` : ''}.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <th className="text-left p-4 font-medium">Provider ID</th>
            <th className="text-left p-4 font-medium">Status</th>
            <th className="text-left p-4 font-medium">Data Size</th>
            <th className="text-left p-4 font-medium">Data Sets</th>
            <th className="text-left p-4 font-medium">Total Pieces</th>
            <th className="text-left p-4 font-medium">Faults</th>
            <th className="text-left p-4 font-medium">Joined Date</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr
              key={provider.id}
              className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700"
            >
              <td className="p-4 font-mono text-sm">
                <Link
                  to={`/providers/${provider.address}`}
                  className="text-blue-500 hover:underline dark:text-blue-400"
                  title={provider.address}
                >
                  {`${provider.address.substring(
                    0,
                    10
                  )}...${provider.address.substring(
                    provider.address.length - 8
                  )}`}
                </Link>
              </td>
              <td className="p-4">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    Number(provider.totalProofSets) > 0
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {Number(provider.totalProofSets) > 0
                    ? 'Active Sets'
                    : 'No Active Sets'}
                </span>
              </td>
              <td className="p-4">{formatDataSize(provider.totalDataSize)}</td>
              <td className="p-4">{provider.totalProofSets}</td>
              <td className="p-4">{provider.totalRoots}</td>
              <td className="p-4">
                <span
                  className={`${
                    Number(provider.totalFaultedPeriods) > 0
                      ? 'text-red-600 font-medium dark:text-red-400'
                      : 'dark:text-gray-300'
                  }`}
                >
                  {provider.totalFaultedPeriods}
                </span>
              </td>
              <td className="p-4">{formatDate(provider.createdAt, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ProvidersTableSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          {[...Array(7)].map((_, i) => (
            <th key={i} className="text-left p-4 font-medium">
              <Skeleton className="h-5 w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(itemsPerPage)].map((_, i) => (
          <tr key={i} className="border-b dark:border-gray-700">
            {[...Array(7)].map((_, j) => (
              <td key={j} className="p-4">
                <Skeleton className="h-5 w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
