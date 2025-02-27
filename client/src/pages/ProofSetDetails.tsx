import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProofSetDetails,
  getProofSetEventLogs,
  ProofSet,
  Activity,
  Transaction,
  EventLog,
} from '@/api/apiService'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Pagination } from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const ProofSetDetails = () => {
  const { proofSetId } = useParams<string>()
  const [proofSet, setProofSet] = useState<ProofSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalEventLogs, setTotalEventLogs] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [eventLogs, setEventLogs] = useState<EventLog[]>([])
  const [activeTab, setActiveTab] = useState('transactions')
  const [methodFilter, setMethodFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    if (!proofSetId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const [proofSetResponse, eventLogsResponse] = await Promise.all([
          getProofSetDetails(
            proofSetId,
            activeTab === 'transactions'
              ? (currentPage - 1) * ITEMS_PER_PAGE
              : 0,
            ITEMS_PER_PAGE
          ),
          getProofSetEventLogs(
            proofSetId,
            activeTab === 'eventLogs' ? (currentPage - 1) * ITEMS_PER_PAGE : 0,
            ITEMS_PER_PAGE
          ),
        ])

        if (!proofSetResponse?.data?.proofSet) {
          throw new Error('Invalid response format: missing proof set data')
        }

        setProofSet(proofSetResponse.data.proofSet)
        setTransactions(proofSetResponse.data.transactions || [])
        setTotalTransactions(proofSetResponse.data.metadata?.total || 0)
        setEventLogs(eventLogsResponse.data.eventLogs || [])
        setTotalEventLogs(eventLogsResponse.data.metadata?.total || 0)

        const txActivities = (proofSetResponse.data.transactions || []).map(
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
  }, [proofSetId, currentPage, activeTab])

  if (loading || !proofSet) return <div>Loading...</div>

  const formatDataSize = (size: string) => {
    if (!size || size === '0') return 'NaN GB'
    return `${(Number(size) / 1024 ** 3).toFixed(2)} GB`
  }

  const formatEpochTime = (epoch: number | null) => {
    if (!epoch) return 'N/A'
    return new Date(epoch * 1000).toLocaleString()
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
    methodFilter
      ? tx.method.toLowerCase().includes(methodFilter.toLowerCase())
      : true
  )

  const filteredEventLogs = eventLogs.filter((log) =>
    eventFilter
      ? log.eventName.toLowerCase().includes(eventFilter.toLowerCase())
      : true
  )

  const uniqueMethods = [...new Set(transactions.map((tx) => tx.method))]
  const uniqueEventNames = [...new Set(eventLogs.map((log) => log.eventName))]

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
              <span className="font-medium">Faults:</span>
              <span>{proofSet.totalFaultedPeriods}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Last Proven:</span>
              <span>
                {proofSet.lastProvenEpoch
                  ? formatEpochTime(proofSet.lastProvenEpoch)
                  : 'Never'}
              </span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="font-medium">Next Challenge:</span>
              <span>{formatEpochTime(proofSet.nextChallengeEpoch)}</span>
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

        {proofSet?.totalRoots > 0 && (
          <div className="p-4 border rounded">
            <h2 className="text-xl font-semibold mb-2">Roots</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: proofSet.totalRoots }).map((_, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded">
                  <div className="font-medium">Root #{index + 1}</div>
                  <div className="text-sm text-gray-600">
                    Status:{' '}
                    {index < (proofSet.totalProvedRoots || 0)
                      ? 'Proved'
                      : 'Unproved'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <SelectItem value="">All Methods</SelectItem>
                    {uniqueMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search methods..."
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-[200px]"
                />
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
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.hash} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <span className="font-mono">{tx.hash}</span>
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
                    ))}
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
                    <SelectItem value="">All Events</SelectItem>
                    {uniqueEventNames.map((eventName) => (
                      <SelectItem key={eventName} value={eventName}>
                        {eventName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search events..."
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-[200px]"
                />
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
                    {filteredEventLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
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
                              <div className="p-3 font-mono text-sm">
                                {(() => {
                                  try {
                                    const jsonData =
                                      typeof log.data === 'string'
                                        ? JSON.parse(log.data)
                                        : log.data

                                    return Object.entries(jsonData).map(
                                      ([key, value]) => (
                                        <div key={key} className="mb-1">
                                          <span className="text-purple-600">
                                            {key}:
                                          </span>{' '}
                                          <span className="text-blue-600">
                                            {typeof value === 'string' &&
                                            value.startsWith('0x') ? (
                                              <a
                                                href={`https://filfox.info/en/address/${value}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline"
                                              >
                                                {value}
                                              </a>
                                            ) : (
                                              String(value)
                                            )}
                                          </span>
                                        </div>
                                      )
                                    )
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
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(totalEventLogs)}
            </TabsContent>
          </Tabs>
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
