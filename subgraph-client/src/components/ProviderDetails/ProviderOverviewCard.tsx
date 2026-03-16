import React from 'react'
import { Provider, WeeklyProviderActivity } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import {
  decodeWeekIdAndProviderId,
  formatDate,
  formatDataSize,
  hexToBytes,
} from '@/utility/helper'

interface ProviderOverviewCardProps {
  provider?: Provider
  activities?: WeeklyProviderActivity[]
  isLoading: boolean
  error: any
}

export const ProviderOverviewCard: React.FC<ProviderOverviewCardProps> = ({
  provider,
  activities = [],
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <ProviderOverviewSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Overview</AlertTitle>
        <AlertDescription>
          Could not load provider details. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!provider) {
    return (
      <Alert variant="default" className="mb-4">
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          Provider details could not be found.
        </AlertDescription>
      </Alert>
    )
  }

  const formatCount = (value: string | undefined) => {
    try {
      return BigInt(value || '0').toLocaleString('en-US')
    } catch {
      return value || '0'
    }
  }

  // Keep all-time values strictly from provider aggregates.
  const faultedPeriodsAllTime = formatCount(provider.totalFaultedPeriods)
  const faultedPiecesAllTime = formatCount(provider.totalFaultedRoots)

  const latestWeekId = activities.reduce((maxWeekId, activity) => {
    const { weekId } = decodeWeekIdAndProviderId(hexToBytes(activity.id))
    return Math.max(maxWeekId, weekId)
  }, 0)

  const latestWeekActivities = activities.filter((activity) => {
    const { weekId } = decodeWeekIdAndProviderId(hexToBytes(activity.id))
    return weekId === latestWeekId
  })

  const faultedPeriods7d = latestWeekActivities.reduce(
    (sum, activity) => sum + Number(activity.totalFaultedPeriods || 0),
    0
  )

  const faultedPieces7d = latestWeekActivities.reduce(
    (sum, activity) => sum + Number(activity.totalFaultedRoots || 0),
    0
  )

  const totalProofsLatest = latestWeekActivities.reduce(
    (sum, activity) => sum + Number(activity.totalProofs || 0),
    0
  )

  const successfulProofsLatest = Math.max(
    0,
    totalProofsLatest - faultedPeriods7d
  )

  const lastSuccessPercent =
    totalProofsLatest > 0
      ? `${((successfulProofsLatest / totalProofsLatest) * 100).toFixed(2)}%`
      : '0.00%'

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Overview</h2>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem title="Total Data Sets" value={provider.totalProofSets} />
        <InfoItem
          title="Data Stored"
          value={formatDataSize(provider.totalDataSize)}
        />
        <InfoItem title="Total Pieces" value={provider.totalRoots} />
        <InfoItem
          title="Faulted Periods (All Time)"
          value={faultedPeriodsAllTime}
        />
        <InfoItem
          title="Faulted Pieces (All Time)"
          value={faultedPiecesAllTime}
        />
        <InfoItem
          title="Faulted Periods (7d)"
          value={faultedPeriods7d.toLocaleString()}
        />
        <InfoItem
          title="Faulted Pieces (7d)"
          value={faultedPieces7d.toLocaleString()}
        />
        <InfoItem title="Last Success(%)" value={lastSuccessPercent} />
        <InfoItem
          title="Joined"
          value={formatDate(provider.createdAt, false)}
        />
      </div>
    </div>
  )
}

// Simple helper for grid items
const InfoItem: React.FC<{ title: string; value: React.ReactNode }> = ({
  title,
  value,
}) => (
  <div className="flex justify-between border-b py-2">
    <span className="font-medium">{title}:</span>
    <span>{value ?? 'N/A'}</span>
  </div>
)

const ProviderOverviewSkeleton: React.FC = () => (
  <div className="p-4 border rounded">
    <Skeleton className="h-6 w-1/4 mb-4" />
    <div className="grid grid-cols-2 gap-4">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="flex justify-between border-b py-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  </div>
)
