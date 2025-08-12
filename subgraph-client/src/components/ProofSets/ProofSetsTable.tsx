import React from 'react'
import { Link } from 'react-router-dom'
import { DataSet } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDataSize } from '@/utility/helper'

interface ProofSetsTableProps {
  dataSets: DataSet[]
  isLoading: boolean
  error: any
  searchQuery: string
}

export const ProofSetsTable: React.FC<ProofSetsTableProps> = ({
  dataSets,
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
        <AlertTitle>Error Loading Data Sets</AlertTitle>
        <AlertDescription>
          Could not load proof sets list. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (dataSets.length === 0) {
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
            <th className="text-left p-4 font-medium">Data Set ID</th>
            <th className="text-left p-4 font-medium">Owner</th>
            <th className="text-left p-4 font-medium">Status</th>
            <th className="text-left p-4 font-medium">Total Pieces</th>
            <th className="text-left p-4 font-medium">Proved Pieces</th>
            <th className="text-left p-4 font-medium">Data Size</th>
            <th className="text-left p-4 font-medium">Last Proof Epoch</th>
            <th className="text-left p-4 font-medium">Next Challenge</th>
          </tr>
        </thead>
        <tbody>
          {dataSets.map((dataSet) => (
            <tr key={dataSet.setId} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700">
              <td className="p-4">
                <Link
                  to={`/proofsets/${dataSet.setId}`}
                  className="text-blue-500 hover:underline dark:text-blue-400"
                >
                  {dataSet.setId}
                </Link>
              </td>
              <td className="p-4 font-mono text-sm">
                <Link
                  to={`/providers/${dataSet.owner.address}`}
                  className="text-blue-500 hover:underline dark:text-blue-400"
                  title={dataSet.owner.address}
                >
                  {`${dataSet.owner.address.substring(
                    0,
                    10
                  )}...${dataSet.owner.address.substring(
                    dataSet.owner.address.length - 8
                  )}`}
                </Link>
              </td>
              <td className="p-4">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    dataSet.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {dataSet.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="p-4">{dataSet.totalRoots}</td>
              <td className="p-4">{dataSet.totalProvedRoots}</td>
              <td className="p-4">{formatDataSize(dataSet.totalDataSize)}</td>
              <td className="p-4">
                {dataSet.lastProvenEpoch
                  ? Number(dataSet.lastProvenEpoch).toLocaleString()
                  : 'Never'}
              </td>
              <td className="p-4">
                {dataSet.nextChallengeEpoch
                  ? Number(dataSet.nextChallengeEpoch).toLocaleString()
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
