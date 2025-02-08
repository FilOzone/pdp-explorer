import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProofSetDetails } from '@/api/apiService'
import { MetricCard } from './Landing'

interface ProofSetDetails {
  proofSetId: string
  status: boolean
  firstRoot: string
  numRoots: number
  createdAt: string
  updatedAt: string
  transactions: Array<{
    txId: string
    time: string
    method: string
    fee: string
    price: number
    exponent: number
  }>
}

export default function ProofSetDetailsPage() {
  const { proofSetId } = useParams()
  const [proofSet, setProofSet] = useState<ProofSetDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getProofSetDetails(proofSetId!, 'all')
        setProofSet(res.data)
      } catch (err) {
        console.error('Error fetching proof set details:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [proofSetId])

  if (loading) return <div className="p-6">Loading...</div>
  if (!proofSet) return <div className="p-6">Proof Set not found</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Proof Set {proofSet.proofSetId}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            Created: {new Date(proofSet.createdAt).toLocaleDateString()}
          </span>
          <span>
            Last Updated: {new Date(proofSet.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Status"
          value={
            <span
              className={`px-2 py-1 rounded ${
                proofSet.status
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {proofSet.status ? 'Active' : 'Inactive'}
            </span>
          }
        />
        <MetricCard title="Total Roots" value={proofSet.numRoots} />
        <MetricCard
          title="First Root"
          value={<code className="font-mono">{proofSet.firstRoot}</code>}
        />
        <MetricCard
          title="Created At"
          value={new Date(proofSet.createdAt).toLocaleDateString()}
        />
      </div>

      {/* Transactions Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transactions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">Tx ID</th>
                <th className="p-2 border">Time</th>
                <th className="p-2 border">Method</th>
                <th className="p-2 border">Fee</th>
                <th className="p-2 border">Price</th>
              </tr>
            </thead>
            <tbody>
              {proofSet.transactions.map((tx, index) => (
                <tr key={index}>
                  <td className="p-2 border font-mono">{tx.txId}</td>
                  <td className="p-2 border">
                    {new Date(tx.time).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">{tx.method}</td>
                  <td className="p-2 border">{tx.fee}</td>
                  <td className="p-2 border">
                    {(tx.price / 10 ** tx.exponent).toFixed(tx.exponent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
