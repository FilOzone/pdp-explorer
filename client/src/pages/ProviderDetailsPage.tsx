import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getProviderDetails } from '@/api/apiService'
import { MetricCard } from './Landing'

interface ProviderDetails {
  providerId: string
  activeProofSets: number
  allProofSets: number
  dataSizeStored: number
  totalPiecesStored: number
  faults: number
  firstSeen: string
  lastSeen: string
  proofSets: Array<{
    proofSetId: string
    status: boolean
    firstRoot: string
    numRoots: number
    createdAt: string
    lastProofReceived: string
  }>
}

export default function ProviderDetailsPage() {
  const { providerId } = useParams()
  const [provider, setProvider] = useState<ProviderDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getProviderDetails(providerId!)
        setProvider(res.data)
      } catch (err) {
        console.error('Error fetching provider details:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providerId])

  if (loading) return <div className="p-6">Loading...</div>
  if (!provider) return <div className="p-6">Provider not found</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Provider {provider.providerId}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            First Seen: {new Date(provider.firstSeen).toLocaleDateString()}
          </span>
          <span>
            Last Seen: {new Date(provider.lastSeen).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Active Proof Sets"
          value={provider.activeProofSets}
        />
        <MetricCard
          title="Data Stored"
          value={`${(provider.dataSizeStored / 1024 ** 3).toFixed(2)} GB`}
        />
        <MetricCard title="Total Faults" value={provider.faults} />
        <MetricCard
          title="First Seen"
          value={new Date(provider.firstSeen).toLocaleDateString()}
        />
      </div>

      {/* Proof Sets Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Proof Sets</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">Proof Set ID</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">First Root</th>
                <th className="p-2 border">Roots</th>
                <th className="p-2 border">Created At</th>
                <th className="p-2 border">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {provider.proofSets.map((proofSet, index) => (
                <tr key={index}>
                  <td className="p-2 border">
                    <Link
                      to={`/proofsets/${proofSet.proofSetId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {proofSet.proofSetId}
                    </Link>
                  </td>
                  <td className="p-2 border">
                    <span
                      className={`px-2 py-1 rounded ${
                        proofSet.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {proofSet.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-2 border font-mono">{proofSet.firstRoot}</td>
                  <td className="p-2 border">{proofSet.numRoots}</td>
                  <td className="p-2 border">
                    {new Date(proofSet.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {new Date(proofSet.lastProofReceived).toLocaleDateString()}
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
