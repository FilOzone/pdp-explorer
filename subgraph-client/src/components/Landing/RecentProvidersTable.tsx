import React from 'react'
import { Provider } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatDataSize } from '@/utility/helper'
import { CopyableText } from '@/components/shared/CopyableText'

interface RecentProvidersTableProps {
  providers?: Provider[]
  isLoading: boolean
  error: any
  itemsToShow?: number
}

export const RecentProvidersTable: React.FC<RecentProvidersTableProps> = ({
  providers,
  isLoading,
  error,
  itemsToShow = 10,
}) => {
  if (isLoading) {
    return <RecentProvidersSkeleton itemsPerPage={itemsToShow} />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Recent Providers</AlertTitle>
        <AlertDescription>
          Could not load recent providers. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No recent providers found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <th className="text-left p-2 font-bold">Provider ID</th>
            <th className="text-left p-2 font-bold">Data Sets</th>
            <th className="text-left p-2 font-bold">Pieces</th>
            <th className="text-left p-2 font-bold">Data Size</th>
            <th className="text-left p-2 font-bold">Joined Date</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr
              key={provider.id}
              className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 text-sm"
            >
              <td className="p-3">
                <CopyableText
                  value={provider.address}
                  to={`/providers/${provider.address}`}
                  truncate={false}
                  label="Provider address"
                  monospace={true}
                />
              </td>
              <td className="p-3">{provider.totalProofSets}</td>
              <td className="p-3">{provider.totalRoots}</td>
              <td className="p-3">{formatDataSize(provider.totalDataSize)}</td>
              <td className="p-3">{formatDate(provider.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const RecentProvidersSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          {[...Array(5)].map((_, i) => (
            <th key={i} className="text-left p-2 font-medium text-sm">
              <Skeleton className="h-[16px] w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(itemsPerPage)].map((_, i) => (
          <tr key={i} className="border-b dark:border-gray-700">
            {[...Array(5)].map((_, j) => (
              <td key={j} className="p-3">
                <Skeleton className="h-[14px] w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
