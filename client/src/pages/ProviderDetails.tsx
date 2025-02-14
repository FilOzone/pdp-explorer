import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProviderDetails,
  getProviderActivities,
  getProviderProofSets,
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
  CartesianGrid,
} from 'recharts'

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
  }>
  label?: string
}

interface ChartActivity {
  timestamp: number
  value: number
  type: string
}

export const ProviderDetails = () => {
  const { providerId } = useParams<string>()
  const [provider, setProvider] = useState<ProviderDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ChartActivity[]>([])
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
              type: activityType,
              startDate: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(), // last 30 days
              endDate: new Date().toISOString(),
            }),
            getProviderProofSets(providerId),
          ]
        )

        // Format activities data for the chart
        const formattedActivities = activitiesData
          .map((activity) => ({
            timestamp: new Date(activity.timestamp).getTime(),
            value: activity.value,
            type: activity.type,
          }))
          .sort((a, b) => a.timestamp - b.timestamp)

        setProvider(providerData)
        setActivities(formattedActivities)
        setProofSets(proofSetsData)
      } catch (error) {
        console.error('Error fetching provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providerId, activityType])

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow">
          <p className="text-sm text-gray-600">
            {label && new Date(label).toLocaleDateString()}
          </p>
          <p className="text-sm font-medium">
            {activityType === 'proof_set_created'
              ? 'Proofs Submitted: '
              : 'Faults: '}
            {payload[0].value}
          </p>
        </div>
      )
    }
    return null
  }

  if (loading || !provider) return <div>Loading...</div>

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/providers" className="text-blue-500 hover:underline">
          ← Back to Providers
        </Link>
        <h1 className="text-2xl font-bold">Provider Details: {providerId}</h1>
      </div>
      <div className="grid gap-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>Active Proof Sets: {provider.activeProofSets}</div>
            <div>Total Proof Sets: {provider.proofSetIds.length}</div>
            <div>
              Data Stored:{' '}
              {(Number(provider.totalDataSize) / 1024 ** 3).toFixed(2)} GB
            </div>
            <div>Total Roots: {provider.numRoots}</div>
            <div>Faults: {provider.totalFaultedPeriods}</div>
            <div>
              First Seen: {new Date(provider.firstSeen).toLocaleDateString()}
            </div>
            <div>
              Last Seen: {new Date(provider.lastSeen).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Provider Activities</h2>
            <select
              className="border rounded p-2"
              value={activityType}
              onChange={(e) =>
                setActivityType(
                  e.target.value as 'proof_set_created' | 'fault_recorded'
                )
              }
            >
              <option value="proof_set_created">Proof Submissions</option>
              <option value="fault_recorded">Faults</option>
            </select>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activities}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(timestamp) =>
                    new Date(timestamp).toLocaleDateString()
                  }
                  stroke="#888"
                />
                <YAxis stroke="#888" />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">ProofSets</h2>
            <Link
              to={`/providers/${providerId}/proofsets`}
              className="text-blue-500 hover:underline"
            >
              View All
            </Link>
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
                  <tr
                    key={proofSet.setId}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">
                      <Link
                        to={`/proofsets/${proofSet.setId}`}
                        className="text-blue-500 hover:underline"
                      >
                        {proofSet.setId}
                      </Link>
                    </td>
                    <td className="p-2">
                      {proofSet.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="p-2">{proofSet.totalRoots}</td>
                    <td className="p-2">
                      {new Date(proofSet.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2">
                      {new Date(proofSet.updatedAt).toLocaleString()}
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
