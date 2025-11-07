import React, { useState, useMemo } from 'react'
import { WeeklyProofSetActivity } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { hexToBytes, decodeWeekIdAndProofSetId } from '@/utility/helper'

interface ProofSetActivityChartProps {
  activities: WeeklyProofSetActivity[]
  isLoading: boolean
  error: any
}

const getLabelAndColor = (activityType: string) => {
  switch (activityType) {
    case 'totalProofs':
      return { label: 'Proof Submissions', color: `hsl(var(--chart-1))` }
    case 'totalFaultedRoots':
      return { label: 'Faulted Pieces', color: 'hsl(var(--chart-2))' }
    case 'totalRootsProved':
      return { label: 'Pieces Proved', color: 'hsl(var(--chart-3))' }
    case 'totalRootsAdded':
      return { label: 'Pieces Added', color: 'hsl(var(--chart-5))' }
    default:
      return { label: 'Proof Submissions', color: `hsl(var(--chart-1))` }
  }
}

export const ProofSetActivityChart: React.FC<ProofSetActivityChartProps> = ({
  activities,
  isLoading,
  error,
}) => {
  const [activityType, setActivityType] = useState<
    'totalProofs' | 'totalFaultedRoots' | 'totalRootsProved' | 'totalRootsAdded'
  >('totalProofs')

  const chartData = useMemo(() => {
    // Sort and potentially transform data if needed (e.g., calculate date from week ID)
    return [...activities]
      .sort(
        (a, b) =>
          decodeWeekIdAndProofSetId(hexToBytes(a.id)).weekId -
          decodeWeekIdAndProofSetId(hexToBytes(b.id)).weekId
      )
      .map((act) => {
        const { weekId } = decodeWeekIdAndProofSetId(hexToBytes(act.id))
        const date = new Date(weekId * 604800 * 1000) // Convert weekId to timestamp
        return {
          totalProofs: Number(act.totalProofs),
          totalFaultedRoots: Number(act.totalFaultedRoots),
          totalRootsProved: Number(act.totalRootsProved),
          totalRootsAdded: Number(act.totalRootsAdded),
          date: date,
          dateLabel: date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        }
      })
  }, [activities])

  const dataKey = activityType
  const { label: yAxisLabel, color: lineColor } = getLabelAndColor(activityType)

  if (isLoading) {
    return <ActivityChartSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Activity</AlertTitle>
        <AlertDescription>
          Could not load proof set activity data. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Weekly Data Set Activity</h2>
        <Select
          value={activityType}
          onValueChange={(value) =>
            setActivityType(
              value as
                | 'totalProofs'
                | 'totalFaultedRoots'
                | 'totalRootsAdded'
                | 'totalRootsProved'
            )
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Activity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalProofs">Proof Submissions</SelectItem>
            <SelectItem value="totalFaultedRoots">Faulted Pieces</SelectItem>
            <SelectItem value="totalRootsProved">Pieces Proved</SelectItem>
            <SelectItem value="totalRootsAdded">Pieces Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activities.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No activity data available for the selected period.
        </div>
      ) : (
        <ChartContainer
          config={{
            [dataKey]: {
              label: yAxisLabel,
              color: lineColor,
            },
          }}
          className="h-64 w-full"
        >
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-muted"
            />
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs fill-muted-foreground"
              width={30}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(value) =>
                    chartData
                      .find((d) => d.dateLabel === value)
                      ?.date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }) || value
                  }
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString()} ${
                      getLabelAndColor(name.toString()).label
                    }`,
                    null,
                  ]}
                />
              }
            />
            <Line
              dataKey={dataKey}
              type="monotone"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  )
}

const ActivityChartSkeleton: React.FC = () => (
  <div className="p-4 border rounded">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-10 w-[200px]" />
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
)
