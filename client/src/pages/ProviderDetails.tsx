import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProviderDetails,
  getProviderActivities,
  getProviderProofSets,
  DataSet,
  ProviderDetailsResponse,
} from '@/api/apiService'
import { Pagination } from '@/components/ui/pagination'
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatDate } from '@/utility/helper'

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
  const [proofSets, setProofSets] = useState<DataSet[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProofSets, setTotalProofSets] = useState(0)
  const ITEMS_PER_PAGE = 10
  const [activityType, setActivityType] = useState<
    'prove_possession' | 'fault_recorded'
  >('prove_possession')

  useEffect(() => {
    if (!providerId) return

    const fetchData = async () => {
      try {
        const [providerData, activitiesData, proofSetsResponse] =
          await Promise.all([
            getProviderDetails(providerId),
            getProviderActivities({
              providerId,
              type: activityType,
              startDate: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              endDate: new Date().toISOString(),
            }),
            getProviderProofSets(
              providerId,
              (currentPage - 1) * ITEMS_PER_PAGE,
              ITEMS_PER_PAGE
            ),
          ])

        // Format activities data for the chart
        const formattedActivities = activitiesData
          .map((activity) => ({
            timestamp: new Date(activity.timestamp).getTime(),
            value: Number(activity.details),
            type: activityType, // Use the current activityType
          }))
          .sort((a, b) => a.timestamp - b.timestamp)

        setProvider(providerData)
        setActivities(formattedActivities)
        setProofSets(proofSetsResponse.data || [])
        setTotalProofSets(proofSetsResponse.metadata.total)
      } catch (error) {
        console.error('Error fetching provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providerId, activityType, currentPage])

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
            <div>Active Data Sets: {provider.activeProofSets}</div>
            <div>Total Data Sets: {provider.proofSetIds.length}</div>
            <div>
              Data Stored:{' '}
              {(Number(provider.totalDataSize) / 1024 ** 3).toFixed(2)} GB
            </div>
            <div>Total Pieces: {provider.numRoots}</div>
            <div>Faults: {provider.totalFaultedPeriods}</div>
            <div>First Seen: {formatDate(provider.firstSeen, false)}</div>
            <div>Last Seen: {formatDate(provider.lastSeen, false)}</div>
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
                  e.target.value as 'prove_possession' | 'fault_recorded'
                )
              }
            >
              <option value="prove_possession">Proof Submissions</option>
              <option value="fault_recorded">Faults</option>
            </select>
          </div>
          <div className="h-64 mt-4">
            <ChartContainer
              config={{
                proofs: {
                  label:
                    activityType === 'prove_possession' ? 'Proofs' : 'Faults',
                  color: '#000',
                },
              }}
              className="h-64 w-full"
            >
              <LineChart
                data={activities}
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(timestamp) =>
                    new Date(timestamp).toLocaleDateString()
                  }
                  className="text-sm fill-muted-foreground"
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-sm fill-muted-foreground"
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  stroke="var(--color-proofs)"
                />
                <ChartTooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={new Date(label).toLocaleDateString()}
                    />
                  )}
                />
              </LineChart>
            </ChartContainer>
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
                  <th className="text-left p-2">Data Set ID</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Root #</th>
                  <th className="text-left p-2">Last Proven Epoch</th>
                  <th className="text-left p-2">Created At</th>
                </tr>
              </thead>
              <tbody>
                {proofSets.map((proofSet, index) => (
                  <tr
                    key={proofSet.setId}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-2">
                      {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
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
                      {proofSet.lastProvenEpoch
                        ? proofSet.lastProvenEpoch.toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="p-2">{formatDate(proofSet.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalProofSets > ITEMS_PER_PAGE && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>
    </div>
  )
}
