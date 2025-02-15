import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProofSetDetails,
  ProofSet,
  Activity,
  Transaction,
} from '@/api/apiService'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Pagination } from '@/components/ui/pagination'

export const ProofSetDetails = () => {
  const { proofSetId } = useParams<string>()
  const [proofSet, setProofSet] = useState<ProofSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    if (!proofSetId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getProofSetDetails(
          proofSetId,
          (currentPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE
        )

        if (!response?.data?.proofSet) {
          throw new Error('Invalid response format: missing proof set data')
        }

        setProofSet(response.data.proofSet)
        setTransactions(response.data.transactions || [])
        setTotalTransactions(response.data.metadata?.total || 0)

        const txActivities = (response.data.transactions || []).map(
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
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [proofSetId, currentPage])

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

        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Transactions</h2>
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
                {transactions.map((tx) => (
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
          {totalTransactions > ITEMS_PER_PAGE && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalTransactions / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
            />
          )}
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
