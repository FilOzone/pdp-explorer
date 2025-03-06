import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProofSetDetails,
  getProofSetTxs,
  getProofSetEventLogs,
  getProofSetRoots,
  ProofSet,
  Activity,
  Transaction,
  EventLog,
  Roots,
} from '@/api/apiService'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Pagination } from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trackedEvents, trackedMethods, explorerUrl } from '@/utility/constants'
import JsonDisplay from '@/components/json-viewer'
import ProofHeatMap from '@/components/proof-heatmap'

export const ProofSetDetails = () => {
  const { proofSetId } = useParams<string>()
  const [proofSet, setProofSet] = useState<ProofSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [currentRootsPage, setCurrentRootsPage] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalEventLogs, setTotalEventLogs] = useState(0)
  const [totalRoots, setTotalRoots] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [eventLogs, setEventLogs] = useState<EventLog[]>([])
  const [roots, setRoots] = useState<Roots[]>([])
  const [activeTab, setActiveTab] = useState('transactions')
  const [methodFilter, setMethodFilter] = useState('All Methods')
  const [eventFilter, setEventFilter] = useState('All Events')
  const ITEMS_PER_PAGE = 10

  console.log(roots)
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
          getProofSetRoots(
            proofSetId,
            (currentRootsPage - 1) * ITEMS_PER_PAGE,
            ITEMS_PER_PAGE
          ),
        ])

        if (!proofSetResponse?.data?.proofSet) {
          throw new Error('Invalid response format: missing proof set data')
        }

        setProofSet(proofSetResponse.data.proofSet)
        setTransactions(transactionsResponse.data.txs || [])
        setTotalTransactions(transactionsResponse.data.metadata?.total || 0)
        setEventLogs(eventLogsResponse.data.eventLogs || [])
        setTotalEventLogs(eventLogsResponse.data.metadata?.total || 0)
        setRoots(rootsResponse.data.roots || [])
        setTotalRoots(rootsResponse.data.metadata?.total || 0)

        const txActivities = (transactionsResponse.data.txs || []).map(
          (tx: Transaction) => ({
            timestamp: tx.createdAt,
            value: Number(tx.value),
            type: tx.method,
          })
        )

        setActivities(txActivities)
      } catch (error) {
        console.error('Error fetching proof set data:', error)
        setProofSet(null)
        setTransactions([])
        setTotalTransactions(0)
        setEventLogs([])
        setTotalEventLogs(0)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [proofSetId])

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
  }, [eventFilter, currentPage, activeTab])

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
  }, [methodFilter, currentPage, activeTab])

  console.log(eventLogs)
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

    if (activeTab === 'roots') fetchDataRoots()
  }, [currentRootsPage])

  if (loading || !proofSet) return <div>Loading...</div>

  const formatDataSize = (size: string) => {
    if (!size || size === '0') return 'NaN GB'
    return `${(Number(size) / 1024 ** 3).toFixed(2)} GB`
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
          onPageChange={setCurrentPage}
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
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/proof-sets" className="text-blue-500 hover:underline">
          ← Back to Proof Sets
        </Link>
        <h1 className="text-2xl font-bold">Proof Set Details: {proofSetId}</h1>
      </div>
      <div className="grid gap-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Owner:</span>
              <Link
                to={`/providers/${proofSet.owner}`}
                className="text-blue-500 hover:underline"
              >
                {proofSet.owner}
              </Link>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Listener Address:</span>
              <span>{proofSet.listenerAddr}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Status:</span>
              <span>{proofSet.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Total Roots:</span>
              <span>{proofSet.totalRoots || 0}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Proved Roots:</span>
              <span>{proofSet.totalProvedRoots || 0}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Data Size:</span>
              <span>{formatDataSize(proofSet.totalDataSize)}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Total Fee Paid:</span>
              <span>{formatTokenAmount(proofSet.totalFeePaid)}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Faulted Periods:</span>
              <span>{proofSet.totalFaultedPeriods}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Last Proven:</span>
              <span>
                {proofSet.lastProvenEpoch
                  ? proofSet.lastProvenEpoch.toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Next Challenge:</span>
              <span>
                {proofSet.nextChallengeEpoch
                  ? proofSet.nextChallengeEpoch.toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Created At:</span>
              <span>{new Date(proofSet.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Updated At:</span>
              <span>{new Date(proofSet.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Proof Set Roots</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Root Id</th>
                  <th className="text-left p-2">Cid</th>
                  <th className="text-left p-2">Raw Size</th>
                  <th className="text-left p-2">Removed</th>
                  <th className="text-left p-2">Total Proofs</th>
                  <th className="text-left p-2">Total Fault Periods</th>
                  <th className="text-left p-2">LastProvenEpoch</th>
                  <th className="text-left p-2">Last Faulted Epoch</th>
                </tr>
              </thead>
              <tbody>
                {roots.length > 0 ? (
                  roots.map((root) => (
                    <tr key={root.rootId} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <span className="font-mono">{root.rootId}</span>
                      </td>
                      <td className="p-2">{root.cid}</td>
                      <td className="p-2">
                        {formatDataSize(root.size?.toString())}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            !root.removed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {root.removed ? 'true' : 'false'}
                        </span>
                      </td>
                      <td className="p-2">{root.totalProofsSubmitted}</td>
                      <td className="p-2">{root.totalPeriodsFaulted}</td>
                      <td className="p-2">
                        {root.lastProvenEpoch
                          ? root.lastProvenEpoch.toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="p-2">
                        {root.lastFaultedEpoch
                          ? root.lastFaultedEpoch.toLocaleString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-center" colSpan={6}>
                      No roots found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {renderRootsPagination(totalRoots)}
          </div>
        </div>

        <div className="p-4 border rounded">
          <Tabs
            defaultValue="transactions"
            onValueChange={(value) => {
              setActiveTab(value)
              setCurrentPage(1)
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="eventLogs">Event Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <div className="mb-4 flex gap-4">
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
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Hash</th>
                      <th className="text-left p-2">Method</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Value</th>
                      <th className="text-left p-2">Height</th>
                      <th className="text-left p-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length > 0 ? (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.hash} className="border-b hover:bg-gray-50">
                          <td className="p-2 space-y-1">
                            <div>
                              <a
                                href={`${explorerUrl}/message/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-blue-600 hover:text-blue-800"
                              >
                                {tx.hash}
                              </a>
                            </div>
                            {tx.messageId && (
                              <div>
                                <a
                                  href={`${explorerUrl}/message/${tx.messageId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm text-gray-600 hover:text-gray-800"
                                >
                                  {tx.messageId}
                                </a>
                              </div>
                            )}
                          </td>
                          <td className="p-2">{tx.method}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                tx.status
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {tx.status ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="p-2">{formatTokenAmount(tx.value)}</td>
                          <td className="p-2">{tx.height}</td>
                          <td className="p-2">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2 text-center" colSpan={6}>
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(totalTransactions)}
            </TabsContent>

            <TabsContent value="eventLogs">
              <div className="mb-4 flex gap-4">
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Events">All Events</SelectItem>
                    {trackedEvents.map((eventName) => (
                      <SelectItem key={eventName} value={eventName}>
                        {eventName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Event Name</th>
                      <th className="text-left p-2">Transaction Hash</th>
                      <th className="text-left p-2">Height</th>
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEventLogs.length > 0 ? (
                      filteredEventLogs.map((log) => (
                        <tr
                          key={`${log.transactionHash}_${log.logIndex}`}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-2">{log.eventName}</td>
                          <td className="p-2">
                            <span className="font-mono">
                              {log.transactionHash}
                            </span>
                          </td>
                          <td className="p-2">{log.blockNumber}</td>
                          <td className="p-2">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-2">
                            <div className="max-w-lg">
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <div className="p-1 bg-white font-mono text-sm">
                                  {(() => {
                                    try {
                                      const jsonData =
                                        typeof log.data === 'string'
                                          ? JSON.parse(log.data)
                                          : log.data

                                      return <JsonDisplay jsonData={jsonData} />
                                    } catch (e) {
                                      return (
                                        <span className="text-red-500">
                                          Invalid JSON data
                                        </span>
                                      )
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2 text-center" colSpan={5}>
                          No events found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(totalEventLogs)}
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-4 border rounded mb-4">
          <h2 className="text-xl font-semibold mb-4">
            Last 7 Days Proving Heat Map
          </h2>
          <div className="mb-2">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border border-gray-300 bg-white"></div>
                <span className="text-sm">Not challenged</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500"></div>
                <span className="text-sm">Successful proof</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500"></div>
                <span className="text-sm">Faulted proof</span>
              </div>
            </div>
            <ProofHeatMap roots={roots} />
          </div>
        </div>

        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Activity History</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activities}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(timestamp) =>
                    new Date(timestamp).toLocaleDateString()
                  }
                />
                <YAxis />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
