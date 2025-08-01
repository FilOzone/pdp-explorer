import React from 'react'
import { NetworkMetrics } from '@/utility/types'
import { MetricItem } from '../shared/MetricItem'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDataSize, formatTokenAmount } from '@/utility/helper'

interface NetworkStatsCardProps {
  metrics?: NetworkMetrics | null
  isLoading: boolean
  error: any
}

export const NetworkStatsCard: React.FC<NetworkStatsCardProps> = ({
  metrics,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <NetworkStatsSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Network Metrics</AlertTitle>
        <AlertDescription>
          Could not load network statistics. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) {
    return (
      <Alert variant="default" className="mb-4">
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          Network metrics are currently unavailable.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricItem
        title="Total Providers"
        value={Number(metrics.totalProviders).toLocaleString()}
      />
      <MetricItem
        title="Total Data Sets"
        value={Number(metrics.totalProofSets).toLocaleString()}
      />
      <MetricItem
        title="Total Data Stored"
        value={formatDataSize(metrics.totalDataSize)}
      />
      <MetricItem
        title="Total Fees Paid (FIL)"
        value={formatTokenAmount(metrics.totalProofFeePaidInFil)}
      />
      <MetricItem
        title="Total Pieces"
        value={Number(metrics.totalActiveRoots).toLocaleString()}
      />
      <MetricItem
        title="Total PDP Proofs"
        value={(Number(metrics.totalProofs) * 5).toLocaleString()}
      />
      <MetricItem
        title="Total Faulted Pieces"
        value={Number(metrics.totalFaultedRoots).toLocaleString()}
      />
      <MetricItem
        title="Total Faulted Periods"
        value={Number(metrics.totalFaultedPeriods).toLocaleString()}
      />
    </div>
  )
}

// Skeleton for the stats card
const NetworkStatsSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm"
      >
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    ))}
  </div>
)
