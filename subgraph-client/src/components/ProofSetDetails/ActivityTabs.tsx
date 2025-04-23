import React, { useState } from 'react'
import { Transaction, EventLog } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Pagination } from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatTokenAmount } from '@/utility/helper'
import { trackedMethods, trackedEvents, explorerUrl } from '@/utility/constants'
import JsonDisplay from '@/components/ProofSetDetails/JsonDisplay'

interface ActivityTabsProps {
  transactions: Transaction[]
  eventLogs: EventLog[]
  totalTransactions: string | number
  totalEventLogs: string | number
  isLoadingTransactions: boolean
  errorTransactions: any
  isLoadingEventLogs: boolean
  errorEventLogs: any
  methodFilter: string
  onMethodFilterChange: (filter: string) => void
  eventFilter: string
  onEventFilterChange: (filter: string) => void
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage: number
}

export const ActivityTabs: React.FC<ActivityTabsProps> = ({
  transactions,
  eventLogs,
  totalTransactions,
  totalEventLogs,
  isLoadingTransactions,
  errorTransactions,
  isLoadingEventLogs,
  errorEventLogs,
  methodFilter,
  onMethodFilterChange,
  eventFilter,
  onEventFilterChange,
  currentPage,
  onPageChange,
  itemsPerPage,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'eventLogs'>(
    'transactions'
  )

  const renderPagination = (total: number | string) => {
    total = Number(total)
    if (total <= itemsPerPage) return null
    return (
      <div className="mt-4 border-t pt-4 dark:border-gray-700">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(total / itemsPerPage)}
          onPageChange={onPageChange}
        />
      </div>
    )
  }

  return (
    <div className="p-4 border rounded dark:border-gray-700">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="transactions">
            Transactions ({Number(totalTransactions).toLocaleString()})
          </TabsTrigger>
          <TabsTrigger value="eventLogs">
            Event Logs ({Number(totalEventLogs).toLocaleString()})
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <div className="flex justify-end mb-4">
            <Select value={methodFilter} onValueChange={onMethodFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Methods">All Methods</SelectItem>
                {trackedMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingTransactions ? (
            <ActivityTableSkeleton itemsPerPage={itemsPerPage} columns={5} />
          ) : errorTransactions ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Transactions</AlertTitle>
              <AlertDescription>
                Could not load transactions. Error:{' '}
                {errorTransactions.message || 'Unknown error'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No transactions found
                  {methodFilter !== 'All Methods'
                    ? ` for method '${methodFilter}'`
                    : ''}
                  .
                </div>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-transparent dark:border-gray-600">
                      <th className="text-left p-2 font-medium">Hash</th>
                      <th className="text-left p-2 font-medium">Height</th>
                      <th className="text-left p-2 font-medium">Method</th>
                      <th className="text-left p-2 font-medium">Value (FIL)</th>
                      <th className="text-left p-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.hash}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-600 dark:border-gray-700"
                      >
                        <td className="p-2 font-mono text-sm">
                          <a
                            href={`${explorerUrl}/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline dark:text-blue-400"
                            title={tx.hash}
                          >
                            {`${tx.hash.substring(0, 8)}...${tx.hash.substring(
                              tx.hash.length - 8
                            )}`}
                          </a>
                        </td>
                        <td className="p-2">
                          {Number(tx.height).toLocaleString()}
                        </td>
                        <td className="p-2">{tx.method}</td>
                        <td className="p-2">{formatTokenAmount(tx.value)}</td>
                        <td className="p-2">{formatDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {renderPagination(totalTransactions)}
        </TabsContent>

        {/* Event Logs Tab */}
        <TabsContent value="eventLogs">
          <div className="flex justify-end mb-4">
            <Select value={eventFilter} onValueChange={onEventFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Events">All Events</SelectItem>
                {trackedEvents.map((event) => (
                  <SelectItem key={event} value={event}>
                    {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingEventLogs ? (
            <ActivityTableSkeleton itemsPerPage={itemsPerPage} columns={5} />
          ) : errorEventLogs ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Event Logs</AlertTitle>
              <AlertDescription>
                Could not load event logs. Error:{' '}
                {errorEventLogs.message || 'Unknown error'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              {eventLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No event logs found
                  {eventFilter !== 'All Events'
                    ? ` for event '${eventFilter}'`
                    : ''}
                  .
                </div>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Tx Hash</th>
                      <th className="text-left p-2 font-medium">Height</th>
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="text-left p-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b hover:bg-transparent dark:hover:bg-gray-600 dark:border-gray-700"
                      >
                        <td className="p-2 font-medium">{log.name}</td>
                        <td className="p-2 font-mono text-sm">
                          <a
                            href={`${explorerUrl}/tx/${log.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline dark:text-blue-400"
                            title={log.transactionHash}
                          >
                            {`${log.transactionHash.substring(
                              0,
                              8
                            )}...${log.transactionHash.substring(
                              log.transactionHash.length - 8
                            )}`}
                          </a>
                        </td>
                        <td className="p-2">{log.blockNumber}</td>
                        <td className="p-2">{formatDate(log.createdAt)}</td>
                        <td className="p-2">
                          <JsonDisplay jsonData={JSON.parse(log.data)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {renderPagination(totalEventLogs)}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const ActivityTableSkeleton: React.FC<{
  itemsPerPage: number
  columns: number
}> = ({ itemsPerPage, columns }) => (
  <div className="overflow-x-auto dark:border-gray-700 dark:bg-gray-800">
    <table className="min-w-full">
      <thead>
        <tr className="border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
          {[...Array(columns)].map((_, i) => (
            <th key={i} className="text-left p-[12px] font-medium">
              <Skeleton className="h-[16.5px] w-3/4" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(itemsPerPage)].map((_, i) => (
          <tr key={i} className="border-b dark:border-gray-700">
            {[...Array(columns)].map((_, j) => (
              <td key={j} className="p-[12px]">
                <Skeleton className="h-[17px] w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
