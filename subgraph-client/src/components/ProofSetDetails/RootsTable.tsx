import React from 'react'
import { Root } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pagination } from '@/components/ui/pagination'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatDataSize, decodeRootCid } from '@/utility/helper'
import { CopyableText } from '../shared/CopyableText'

interface RootsTableProps {
  roots: Root[]
  totalRoots: number
  isLoading: boolean
  error: any
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage: number
}

export const RootsTable: React.FC<RootsTableProps> = ({
  roots,
  totalRoots,
  isLoading,
  error,
  currentPage,
  onPageChange,
  itemsPerPage,
}) => {
  if (isLoading) {
    return <RootsTableSkeleton itemsPerPage={itemsPerPage} />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Pieces</AlertTitle>
        <AlertDescription>
          Could not load roots data. Error: {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  const renderPagination = () => {
    if (totalRoots <= itemsPerPage) return null
    return (
      <div className="mt-4 border-t pt-4 dark:border-gray-700">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalRoots / itemsPerPage)}
          onPageChange={onPageChange}
        />
      </div>
    )
  }

  return (
    <div className="p-4 border rounded dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Pieces</h2>
      <div className="overflow-x-auto">
        {roots.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No roots found for this proof set.
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-transparent dark:border-gray-600">
                <th className="text-left p-2 font-medium">id</th>
                <th className="text-left p-2 font-medium">Root CID</th>
                <th className="text-left p-2 font-medium">Size</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Data</th>
                <th className="text-left p-2 font-medium">Faults</th>
                <th className="text-left p-2 font-medium">Last Proven</th>
                <th className="text-left p-2 font-medium">Last Faulted</th>
              </tr>
            </thead>
            <tbody>
              {roots.map((root) => {
                const cidStr = root.cid ? decodeRootCid(root.cid) : 'N/A'
                return (
                  <tr
                    key={root.id}
                    className="border-b hover:bg-gray-50 dark:hover:bg-gray-600 dark:border-gray-700"
                  >
                    <td className="p-2">{root.rootId}</td>
                    <td className="p-2 font-mono text-sm">
                      <CopyableText
                        value={cidStr}
                        monospace={true}
                        label="Root CID"
                      />
                    </td>
                    <td className="p-2">{formatDataSize(root.rawSize)}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          root.removed
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}
                      >
                        {root.removed ? 'Removed' : 'Active'}
                      </span>
                    </td>
                    <td className="p-2">{root.totalProofsSubmitted || 0}</td>
                    <td className="p-2">
                      <span
                        className={`${
                          Number(root.totalPeriodsFaulted) > 0
                            ? 'text-red-600 font-medium dark:text-red-400'
                            : 'dark:text-gray-300'
                        }`}
                      >
                        {root.totalPeriodsFaulted || 0}
                      </span>
                    </td>
                    <td className="p-2">
                      {root.lastProvenAt !== '0'
                        ? formatDate(root.lastProvenAt)
                        : 'Never'}
                    </td>
                    <td className="p-2">
                      {root.lastFaultedAt !== '0'
                        ? formatDate(root.lastFaultedAt)
                        : 'Never'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {renderPagination()}
    </div>
  )
}

const RootsTableSkeleton: React.FC<{ itemsPerPage: number }> = ({
  itemsPerPage,
}) => (
  <div className="p-4 border rounded dark:border-gray-700 dark:bg-gray-800">
    <Skeleton className="h-6 w-1/4 mb-4" />
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            {[...Array(8)].map((_, i) => (
              <th key={i} className="text-left p-[12px] font-medium">
                <Skeleton className="h-[16.5px] w-3/4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(itemsPerPage)].map((_, i) => (
            <tr key={i} className="border-b dark:border-gray-700">
              {[...Array(8)].map((_, j) => (
                <td key={j} className="p-[12px]">
                  <Skeleton className="h-[17px] w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="mt-4 border-t pt-4 dark:border-gray-700">
      <div className="flex justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
    </div>
  </div>
)
