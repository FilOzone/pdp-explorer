import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProofSetDetails,
  getProofSetTxs,
  getProofSetEventLogs,
  getProofSetRoots,
  ProofSet,
  Transaction,
  EventLog,
  Roots,
} from '@/api/apiService'
import { Pagination } from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronUp,
  Database,
  User,
  HardDrive,
  Activity,
  Hash,
  FileText,
  Calendar,
  BarChart2,
} from 'lucide-react'
import { trackedEvents, trackedMethods, explorerUrl } from '@/utility/constants'
import JsonDisplay from '@/components/json-viewer'
import ProofHeatMap from '@/components/proof-heatmap'
import { formatDate, formatDataSize } from '@/utility/helper'

interface EventLogData {
  value?: string
  [key: string]: string | number | boolean | null | undefined | object
}

type ExtendedEventLog = EventLog & {
  data: EventLogData
}

export const ProofSetDetails = () => {
  const { proofSetId } = useParams<string>()
  const [proofSet, setProofSet] = useState<ProofSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentRootsPage, setCurrentRootsPage] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalEventLogs, setTotalEventLogs] = useState(0)
  const [totalRoots, setTotalRoots] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [eventLogs, setEventLogs] = useState<ExtendedEventLog[]>([])
  const [roots, setRoots] = useState<Roots[]>([])
  const [heatmapRoots, setHeatmapRoots] = useState<Roots[]>([])
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false)
  const [isLoadingAllRoots, setIsLoadingAllRoots] = useState(false)
  const [activeTab, setActiveTab] = useState('transactions')
  const [methodFilter, setMethodFilter] = useState('All Methods')
  const [eventFilter, setEventFilter] = useState('All Events')
  const ITEMS_PER_PAGE = 10
  const ROOTS_PER_PAGE = 100

  useEffect(() => {
    if (!proofSetId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const [
          proofSetResponse,
          transactionsResponse,
          eventLogsResponse,
          rootsResponse,
          heatmapRootsResponse,
        ] = await Promise.all([
          getProofSetDetails(proofSetId),
          getProofSetTxs(
            proofSetId,
            'all',
            activeTab === 'transactions'
              ? (currentPage - 1) * ITEMS_PER_PAGE
              : 0,
            ITEMS_PER_PAGE
          ),
          getProofSetEventLogs(
            proofSetId,
            'all',
            activeTab === 'eventLogs' ? (currentPage - 1) * ITEMS_PER_PAGE : 0,
            ITEMS_PER_PAGE
          ),
          getProofSetRoots(proofSetId, 0, ITEMS_PER_PAGE),
          getProofSetRoots(proofSetId, 0, ROOTS_PER_PAGE, 'root_id', 'desc'),
        ])

        if (!proofSetResponse?.data?.proofSet) {
          throw new Error('Invalid response format: missing proof set data')
        }

        setProofSet(proofSetResponse.data.proofSet)
        setTransactions(transactionsResponse.data.txs || [])
        setTotalTransactions(transactionsResponse.data.metadata?.total || 0)
        setEventLogs(eventLogsResponse.data.eventLogs || [])
        setTotalEventLogs(eventLogsResponse.data.metadata?.total || 0)
        setRoots(rootsResponse.data.roots.slice(0, ITEMS_PER_PAGE) || [])
        setHeatmapRoots(heatmapRootsResponse.data.roots || [])
        setTotalRoots(rootsResponse.data.metadata?.total || 0)
      } catch (error) {
        console.error('Error fetching proof set data:', error)
        setProofSet(null)
        setTransactions([])
        setTotalTransactions(0)
        setEventLogs([])
        setTotalEventLogs(0)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [proofSetId, currentPage, activeTab])

  useEffect(() => {
    if (!proofSetId) return

    const fetchDataEventLogs = async () => {
      try {
        const response = await getProofSetEventLogs(
          proofSetId,
          eventFilter === 'All Events' ? 'all' : eventFilter,
          (currentPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE
        )
        setEventLogs(response.data.eventLogs || [])
        setTotalEventLogs(response.data.metadata?.total || 0)
      } catch (error) {
        console.error('Error fetching proof set data:', error)
        setEventLogs([])
        setTotalEventLogs(0)
      }
    }

    if (activeTab === 'eventLogs') fetchDataEventLogs()
  }, [eventFilter, currentPage, activeTab, proofSetId])

  useEffect(() => {
    const fetchDataTxs = async () => {
      try {
        const response = await getProofSetTxs(
          proofSetId,
          methodFilter === 'All Methods' ? 'all' : methodFilter,
          (currentPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE
        )
        setTransactions(response.data.txs || [])
        setTotalTransactions(response.data.metadata?.total || 0)
      } catch (error) {
        console.error('Error fetching proof set data:', error)
        setTransactions([])
        setTotalTransactions(0)
      }
    }

    if (activeTab === 'transactions') fetchDataTxs()
  }, [methodFilter, currentPage, activeTab, proofSetId])

  useEffect(() => {
    const fetchDataRoots = async () => {
      try {
        const response = await getProofSetRoots(
          proofSetId,
          (currentRootsPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE
        )
        setRoots(response.data.roots || [])
        setTotalRoots(response.data.metadata?.total || 0)
      } catch (error) {
        console.error('Error fetching proof set data:', error)
        setRoots([])
        setTotalRoots(0)
      }
    }

    fetchDataRoots()
  }, [currentRootsPage, proofSetId])

  useEffect(() => {
    if (!isHeatmapExpanded || !proofSetId) return

    const fetchAllRoots = async () => {
      try {
        setIsLoadingAllRoots(true)
        const response = await getProofSetRoots(
          proofSetId,
          0,
          totalRoots,
          'root_id',
          'desc'
        )
        setHeatmapRoots(response.data.roots || [])
      } catch (error) {
        console.error('Error fetching all roots:', error)
      } finally {
        setIsLoadingAllRoots(false)
      }
    }

    fetchAllRoots()
  }, [isHeatmapExpanded, proofSetId, totalRoots])

  if (loading || !proofSet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    )
  }

  const formatTokenAmount = (attoFil: string) => {
    if (!attoFil || attoFil === '0') return '0 FIL'

    const units = [
      { name: 'FIL', decimals: 18 },
      { name: 'milliFIL', decimals: 15 },
      { name: 'microFIL', decimals: 12 },
      { name: 'nanoFIL', decimals: 9 },
      { name: 'picoFIL', decimals: 6 },
      { name: 'femtoFIL', decimals: 3 },
      { name: 'attoFIL', decimals: 0 },
    ]

    const value = BigInt(attoFil)

    for (const unit of units) {
      const divisor = BigInt(10) ** BigInt(unit.decimals)
      const unitValue = Number(value) / Number(divisor)

      if (unitValue >= 1) {
        const decimals = unit.name === 'FIL' ? 4 : 2
        return `${unitValue.toFixed(decimals)} ${unit.name}`
      }
    }

    return '0 FIL'
  }

  const filteredTransactions = transactions.filter((tx) =>
    methodFilter !== 'All Methods'
      ? tx.method.toLowerCase().includes(methodFilter.toLowerCase())
      : true
  )

  const filteredEventLogs = eventLogs.filter((log) =>
    eventFilter !== 'All Events'
      ? log.eventName.toLowerCase().includes(eventFilter.toLowerCase())
      : true
  )

  const renderPagination = (total: number) => {
    if (total <= ITEMS_PER_PAGE) return null

    return (
      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(total / ITEMS_PER_PAGE)}
          onPageChange={(page: number) => setCurrentPage(page)}
        />
      </div>
    )
  }

  const renderRootsPagination = (total: number) => {
    if (total <= ITEMS_PER_PAGE) return null

    return (
      <div className="mt-4">
        <Pagination
          currentPage={currentRootsPage}
          totalPages={Math.ceil(total / ITEMS_PER_PAGE)}
          onPageChange={setCurrentRootsPage}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-semibold text-gray-900">
                Proof Set Details
              </h1>
            </div>
            <p className="text-gray-500">ID: {proofSet.setId}</p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              proofSet.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {proofSet.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <User className="h-4 w-4" />
              Owner
            </div>
            <Link
              to={`/providers/${proofSet.owner}`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {proofSet.owner}
            </Link>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <HardDrive className="h-4 w-4" />
              Data Size
            </div>
            <div className="text-gray-900 font-medium">
              {formatDataSize(proofSet.totalDataSize)}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <Activity className="h-4 w-4" />
              Roots Status
            </div>
            <div className="text-gray-900 font-medium">
              {proofSet.totalProvedRoots} / {proofSet.totalRoots} Proved
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
              <Calendar className="h-4 w-4" />
              Last Activity
            </div>
            <div className="text-gray-900 font-medium">
              {formatDate(proofSet.lastProvenEpoch.toString())}
            </div>
          </div>
        </div>

        <Collapsible>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">
                Proof Activity Heatmap
              </h2>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHeatmapExpanded(!isHeatmapExpanded)}
                className="flex items-center gap-2"
              >
                {isHeatmapExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show More
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="bg-gray-50 rounded-lg p-4">
              {isLoadingAllRoots ? (
                <div className="flex items-center justify-center h-32">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  </div>
                </div>
              ) : (
                <ProofHeatMap roots={heatmapRoots} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger
                value="transactions"
                className="flex items-center gap-2"
              >
                <Hash className="h-4 w-4" />
                Transactions
              </TabsTrigger>
              <TabsTrigger
                value="eventLogs"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Event Logs
              </TabsTrigger>
              <TabsTrigger value="roots" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Roots
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="transactions" className="p-6 pt-2">
            <div className="flex justify-end mb-4">
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by method" />
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Transaction Hash
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Method
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.hash}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <a
                          href={`${explorerUrl}/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{tx.method}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            Number(tx.status) === 1
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {Number(tx.status) === 1 ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(tx.createdAt.toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No transactions found</p>
                </div>
              )}
            </div>
            {renderPagination(totalTransactions)}
          </TabsContent>

          <TabsContent value="eventLogs" className="p-6 pt-2">
            <div className="flex justify-end mb-4">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by event" />
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
            <div className="space-y-4">
              {filteredEventLogs.map((log) => (
                <div
                  key={`${log.transactionHash}-${log.logIndex}`}
                  className="bg-gray-50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {log.eventName}
                    </span>
                    <a
                      href={`${explorerUrl}/tx/${log.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Transaction
                    </a>
                  </div>
                  <div className="mt-2">
                    {log.data.value && (
                      <div className="text-sm">
                        Amount: {formatTokenAmount(log.data.value)}
                      </div>
                    )}
                    <JsonDisplay jsonData={log.data} />
                  </div>
                </div>
              ))}
              {filteredEventLogs.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No event logs found</p>
                </div>
              )}
            </div>
            {renderPagination(totalEventLogs)}
          </TabsContent>

          <TabsContent value="roots" className="p-6 pt-2">
            <div className="space-y-4">
              {roots.map((root) => (
                <div key={root.rootId} className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        Root ID
                      </div>
                      <div className="text-gray-900">{root.rootId}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        Status
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          root.totalProofsSubmitted > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {root.totalProofsSubmitted > 0 ? 'Proved' : 'Unproved'}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        Data Size
                      </div>
                      <div className="text-gray-900">
                        {formatDataSize(root.size?.toString())}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        Last Update
                      </div>
                      <div className="text-gray-900">
                        {formatDate(root.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {roots.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No roots found</p>
                </div>
              )}
            </div>
            {renderRootsPagination(totalRoots)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
