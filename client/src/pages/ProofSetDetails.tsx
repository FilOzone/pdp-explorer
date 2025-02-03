import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const chartData = [
  { month: 'Jan', proofs: 186 },
  { month: 'Feb', proofs: 305 },
  { month: 'Mar', proofs: 237 },
  { month: 'Apr', proofs: 73 },
  { month: 'May', proofs: 209 },
  { month: 'Jun', proofs: 214 },
]

const chartConfig = {
  proofs: {
    label: 'Proofs',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

// Update the heatmap data structure to represent a 5x7 grid
const createHeatmapData = () => {
  const rows = 5
  const cols = 7
  return Array(rows)
    .fill(null)
    .map(() =>
      Array(cols)
        .fill(null)
        .map(() => ({
          status: ['idle', 'success', 'failed'][Math.floor(Math.random() * 3)],
          rootPieceId: 'root-' + Math.random().toString(36).substr(2, 9),
        }))
    )
}

// Update the dummy data
const dummyProofSetDetails = {
  providerId: '123',
  createTime: '2024-01-01',
  deletionTime: '2024-01-01',
  latestTx: '0x123',
  proofsSubmitted: 100,
  faults: 10,
  heatmap: createHeatmapData(),
  transactions: [
    {
      type: 'rootsAdded',
      time: '2024-03-20T15:30:00Z',
      txHash: '0x123...abc',
      status: 'success',
    },
  ],
}

export const ProofSetDetails = () => {
  const { proofSetId } = useParams()
  const [details, setDetails] = useState(dummyProofSetDetails)
  const [activeTab, setActiveTab] = useState('allTransactions')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setDetails(dummyProofSetDetails)
      setLoading(false)
    }, 1000)
  }, [proofSetId])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Overview Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">
          ProofSet #{proofSetId} Overview
        </h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Link
              to={`/providers/${details.providerId}`}
              className="text-blue-500 hover:underline"
            >
              Provider ID: {details.providerId}
            </Link>
          </div>
          <div>
            Create Time: {new Date(details.createTime).toLocaleString()}
          </div>
          <div>
            Deletion Time:{' '}
            {details.deletionTime
              ? new Date(details.deletionTime).toLocaleString()
              : 'N/A'}
          </div>
          <div>Latest Tx: {details.latestTx}</div>
          <div># of proofs submitted: {details.proofsSubmitted}</div>
          <div># of faults: {details.faults}</div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>ProofSet Change</CardTitle>
            <CardDescription>
              Showing proof submission activity over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="proofs"
                  type="natural"
                  fill="var(--color-proofs)"
                  fillOpacity={0.4}
                  stroke="var(--color-proofs)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium leading-none">
                  Activity trending up by 2.4% this month{' '}
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  January - June 2024
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Transactions Section */}
      <div className="mb-8">
        <div className="flex gap-2 mb-4">
          {[
            'All Transactions',
            'rootsAdded',
            'RootsScheduledRemove',
            'possessionProven',
            'EventLogs',
          ].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded ${
                activeTab === tab.toLowerCase().replace(/\s+/g, '')
                  ? 'bg-blue-500 text-white'
                  : 'border hover:bg-gray-50'
              }`}
              onClick={() =>
                setActiveTab(tab.toLowerCase().replace(/\s+/g, ''))
              }
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          {/* Transaction list would go here */}
          <div className="space-y-2">
            {details.transactions.map((tx, i) => (
              <div key={i} className="p-2 border rounded">
                <div>Type: {tx.type}</div>
                <div>Time: {new Date(tx.time).toLocaleString()}</div>
                <div>Hash: {tx.txHash}</div>
                <div>Status: {tx.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">7 days Proving HeatMap</h2>
        <TooltipProvider>
          <div className="flex flex-col gap-1">
            {details.heatmap.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((cell, cellIndex) => (
                  <Tooltip key={`${rowIndex}-${cellIndex}`}>
                    <TooltipTrigger>
                      <div
                        className={`w-6 h-6 rounded border ${
                          cell.status === 'success'
                            ? 'bg-green-500'
                            : cell.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-gray-100'
                        } hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Root: {cell.rootPieceId}</p>
                      <p>Status: {cell.status}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </TooltipProvider>
        <div className="mt-4 text-sm text-gray-600">
          <div>Note:</div>
          <div>
            - □ is a root, when hop the mouse on to a box a root piece cid is
            shown
          </div>
          <div>
            - ■ is when this root was challenged & had a successful proof
            submitted
          </div>
          <div>- ■ is when this root was challenged & it faulted</div>
        </div>
      </div>
    </div>
  )
}
