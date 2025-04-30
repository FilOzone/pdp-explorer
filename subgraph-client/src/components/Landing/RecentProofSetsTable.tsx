import React from 'react'
import { ProofSet } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDataSize, formatDate } from '@/utility/helper'
import { CopyableText } from '@/components/shared/CopyableText'

interface RecentProofSetsTableProps {
  proofSets?: ProofSet[]
  isLoading: boolean
  error: any
  itemsToShow?: number
}

export const RecentProofSetsTable: React.FC<RecentProofSetsTableProps> = ({
  proofSets,
  isLoading,
  error,
  itemsToShow = 10,
}) => {
  if (isLoading) {
    return <RecentProofSetsSkeleton itemsPerPage={itemsToShow} />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Recent Proof Sets</AlertTitle>
        <AlertDescription>
          Could not load recent proof sets. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!proofSets || proofSets.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No recent proof sets found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <th className="text-left p-2 font-bold">Proof Set ID</th>
            <th className="text-left p-2 font-bold">Owner</th>
            <th className="text-left p-2 font-bold">Status</th>
            <th className="text-left p-2 font-bold">Roots</th>
            <th className="text-left p-2 font-bold">Data Size</th>
            <th className="text-left p-2 font-bold">Created At</th>
          </tr>
        </thead>
        <tbody>
          {proofSets.map((proofSet) => (
            <tr
              key={proofSet.setId}
              className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 text-sm"
            >
              <td className="p-3">
                <CopyableText
                  value={proofSet.setId}
                  to={`/proofsets/${proofSet.setId}`}
                  label="Proof Set ID"
                  monospace={true}
                />
              </td>
              <td className="p-3">
                <CopyableText
                  value={proofSet.owner.address}
                  to={`/providers/${proofSet.owner.address}`}
                  truncate={true}
                  truncateLength={8}
                  label="Provider address"
                  monospace={true}
                />
              </td>
              <td className="p-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    proofSet.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {proofSet.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="p-3">{proofSet.totalRoots}</td>
              <td className="p-3">{formatDataSize(proofSet.totalDataSize)}</td>
              <td className="p-3">{formatDate(proofSet.createdAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const RecentProofSetsSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          {[...Array(6)].map((_, i) => (
            <th key={i} className="text-left p-2 font-medium text-sm">
              <Skeleton className="h-[16px] w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(itemsPerPage)].map((_, i) => (
          <tr key={i} className="border-b dark:border-gray-700">
            {[...Array(6)].map((_, j) => (
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
