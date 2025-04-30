import React from 'react'
import { Link } from 'react-router-dom'
import { ProofSet } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDataSize } from '@/utility/helper'

interface ProofSetsTableProps {
  proofSets: ProofSet[]
  isLoading: boolean
  error: any
  searchQuery: string
}

export const ProofSetsTable: React.FC<ProofSetsTableProps> = ({
  proofSets,
  isLoading,
  error,
  searchQuery,
}) => {
  if (isLoading) {
    return <ProofSetsTableSkeleton itemsPerPage={10} />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Proof Sets</AlertTitle>
        <AlertDescription>
          Could not load proof sets list. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (proofSets.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No proof sets found{searchQuery ? ` matching "${searchQuery}"` : ''}.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <th className="text-left p-4 font-medium">Proof Set ID</th>
            <th className="text-left p-4 font-medium">Owner</th>
            <th className="text-left p-4 font-medium">Status</th>
            <th className="text-left p-4 font-medium">Total Roots</th>
            <th className="text-left p-4 font-medium">Proved Roots</th>
            <th className="text-left p-4 font-medium">Data Size</th>
            <th className="text-left p-4 font-medium">Last Proof Epoch</th>
            <th className="text-left p-4 font-medium">Next Challenge</th>
          </tr>
        </thead>
        <tbody>
          {proofSets.map((proofSet) => (
            <tr key={proofSet.setId} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700">
              <td className="p-4">
                <Link
                  to={`/proofsets/${proofSet.setId}`}
                  className="text-blue-500 hover:underline dark:text-blue-400"
                >
                  {proofSet.setId}
                </Link>
              </td>
              <td className="p-4 font-mono text-sm">
                <Link
                  to={`/providers/${proofSet.owner.address}`}
                  className="text-blue-500 hover:underline dark:text-blue-400"
                  title={proofSet.owner.address}
                >
                  {`${proofSet.owner.address.substring(
                    0,
                    10
                  )}...${proofSet.owner.address.substring(
                    proofSet.owner.address.length - 8
                  )}`}
                </Link>
              </td>
              <td className="p-4">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    proofSet.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {proofSet.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="p-4">{proofSet.totalRoots}</td>
              <td className="p-4">{proofSet.totalProvedRoots}</td>
              <td className="p-4">{formatDataSize(proofSet.totalDataSize)}</td>
              <td className="p-4">
                {proofSet.lastProvenEpoch
                  ? Number(proofSet.lastProvenEpoch).toLocaleString()
                  : 'Never'}
              </td>
              <td className="p-4">
                {proofSet.nextChallengeEpoch
                  ? Number(proofSet.nextChallengeEpoch).toLocaleString()
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ProofSetsTableSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          {[...Array(8)].map((_, i) => (
            <th key={i} className="text-left p-4 font-medium">
              <Skeleton className="h-5 w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(itemsPerPage)].map((_, i) => (
          <tr key={i} className="border-b dark:border-gray-700">
            {[...Array(8)].map((_, j) => (
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
