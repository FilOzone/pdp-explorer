import React from 'react'
import { Link } from 'react-router-dom'
import { RootData } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pagination } from '@/components/ui/pagination'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatDataSize } from '@/utility/helper'

interface PieceDataSetsTableProps {
  rootsData: RootData[]
  totalProofSets: number
  isLoading: boolean
  error: any
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage: number
}

export const PieceDataSetsTable: React.FC<PieceDataSetsTableProps> = ({
  rootsData,
  totalProofSets,
  isLoading,
  error,
  currentPage,
  onPageChange,
  itemsPerPage,
}) => {
  if (isLoading) {
    return <ProviderProofSetsTableSkeleton itemsPerPage={itemsPerPage} />
  }

  if (error && !rootsData?.length) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Data Sets</AlertTitle>
        <AlertDescription>
          Could not load proof sets for this provider. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  const renderPagination = () => {
    if (totalProofSets <= itemsPerPage) return null
    return (
      <div className="mt-4 border-t pt-4 dark:border-gray-700">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalProofSets / itemsPerPage)}
          onPageChange={onPageChange}
        />
      </div>
    )
  }

  return (
    <div className="p-4 border rounded dark:border-gray-700 dark:bg-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold dark:text-white">Data Sets ({totalProofSets})</h2>
      </div>
      <div className="overflow-x-auto">
        {rootsData.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            This provider has no proof sets.
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                <th className="text-left p-2 font-medium">#</th>
                <th className="text-left p-2 font-medium">Data Set ID</th>
                <th className="text-left p-2 font-medium">Provider Address</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Data Size</th>
                <th className="text-left p-2 font-medium">Pieces</th>
                <th className="text-left p-2 font-medium">Last Proven Epoch</th>
                <th className="text-left p-2 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody>
              {rootsData.map((rootData, index) => (
                <tr key={rootData.proofSet.setId} className="border-b hover:bg-gray-50 dark:hover:bg-gray-600 dark:border-gray-700">
                  <td className="p-2">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="p-2">
                    <Link
                      to={`/dataset/${rootData.proofSet.setId}`}
                      className="text-blue-500 hover:underline dark:text-blue-400"
                    >
                      {rootData.proofSet.setId}
                    </Link>
                  </td>
                  <td className="p-2">
                    <Link
                      to={`/providers/${rootData.proofSet.owner.address}`}
                      className="text-blue-500 hover:underline dark:text-blue-400"
                    >
                      {rootData.proofSet.owner.address}
                    </Link>
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        rootData.proofSet.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {rootData.proofSet.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-2">
                    {formatDataSize(rootData.proofSet.totalDataSize)}
                  </td>
                  <td className="p-2">{rootData.proofSet.totalRoots}</td>
                  <td className="p-2">
                    {rootData.proofSet.lastProvenEpoch
                      ? Number(rootData.proofSet.lastProvenEpoch).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="p-2">
                    {formatDate(rootData.proofSet.createdAt, false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {renderPagination()}
    </div>
  )
}

const ProviderProofSetsTableSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="p-4 border rounded dark:border-gray-700 dark:bg-gray-800">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-6 w-1/4" />
      {/* <!-- Optional Skeleton for View All link --> */}
      {/* <Skeleton className="h-5 w-16" /> */}
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            {[...Array(7)].map((_, i) => (
              <th key={i} className="text-left p-[12px] font-medium">
                <Skeleton className="h-[16.5px] w-3/4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(itemsPerPage)].map((_, i) => (
            <tr key={i} className="border-b dark:border-gray-700">
              {[...Array(7)].map((_, j) => (
                <td key={j} className="p-[12px]">
                  <Skeleton className="h-[17px] w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
