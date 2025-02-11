import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getProviderDetails,
  getProviderActivities,
  getProviderProofSets,
  Activity,
  ProofSet,
  ProviderDetailsResponse,
} from '@/api/apiService'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export const ProviderDetails = () => {
  const { providerId } = useParams<string>()
  const [provider, setProvider] = useState<ProviderDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [proofSets, setProofSets] = useState<ProofSet[]>([])
  const [activityType, setActivityType] = useState<
    'proof_set_created' | 'fault_recorded'
  >('proof_set_created')

  useEffect(() => {
    if (!providerId) return

    const fetchData = async () => {
      try {
        const [providerData, activitiesData, proofSetsData] = await Promise.all(
          [
            getProviderDetails(providerId),
            getProviderActivities({
              providerId,
              type:
                activityType === 'proof_set_created' ? 'onboarding' : 'faults',
            }),
            getProviderProofSets(providerId),
          ]
        )

        setProvider(providerData)
        setActivities(activitiesData)
        setProofSets(proofSetsData)
      } catch (error) {
        console.error('Error fetching provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providerId, activityType])

  if (loading || !provider) return <div>Loading...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        Provider Details: {providerId}
      </h1>
      <div className="grid gap-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>Active Proof Sets: {provider.activeProofSets}</div>
            <div>Total Proof Sets: {provider.allProofSets}</div>
            <div>
              Data Stored:{' '}
              {(provider.dataSizeStored / 1024 / 1024 / 1024).toFixed(2)} GB
            </div>
            <div>Total Pieces: {provider.totalPiecesStored}</div>
            <div>Faults: {provider.faults}</div>
            <div>
              First Seen: {new Date(provider.firstSeen).toLocaleDateString()}
            </div>
            <div>
              Last Seen: {new Date(provider.lastSeen).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Provider Activities</h2>
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
                <Tooltip
                  labelFormatter={(timestamp) =>
                    new Date(timestamp).toLocaleString()
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-right">
            <select
              className="border rounded p-1"
              value={activityType}
              onChange={(e) =>
                setActivityType(e.target.value as typeof activityType)
              }
            >
              <option value="proof_set_created">1. Proof Sets Created</option>
              <option value="fault_recorded">2. Faults Recorded</option>
            </select>
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">ProofSets</h2>
            <button className="text-blue-500 hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Proof Set ID</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Root #</th>
                  <th className="text-left p-2">Created At</th>
                  <th className="text-left p-2">Last Proof</th>
                </tr>
              </thead>
              <tbody>
                {proofSets.map((proofSet, index) => (
                  <tr key={proofSet.proofSetId} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{proofSet.proofSetId}</td>
                    <td className="p-2">
                      {proofSet.status ? 'Active' : 'Inactive'}
                    </td>
                    <td className="p-2">{proofSet.numRoots}</td>
                    <td className="p-2">
                      {new Date(proofSet.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2">
                      {new Date(proofSet.lastProofReceived).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
