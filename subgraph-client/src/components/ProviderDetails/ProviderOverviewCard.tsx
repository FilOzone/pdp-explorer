import React from 'react'
import { Provider } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDate, formatDataSize } from '@/utility/helper'

interface ProviderOverviewCardProps {
  provider?: Provider
  isLoading: boolean
  error: any
}

export const ProviderOverviewCard: React.FC<ProviderOverviewCardProps> = ({
  provider,
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

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <InfoItem title="Total Proof Sets" value={provider.totalProofSets} />
        <InfoItem
          title="Data Stored"
          value={formatDataSize(provider.totalDataSize)}
        />
        <InfoItem title="Total Roots" value={provider.totalRoots} />
        <InfoItem
          title="Faulted Periods"
          value={provider.totalFaultedPeriods}
        />
        <InfoItem title="Faulted Roots" value={provider.totalFaultedRoots} />
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
  <div className="border-b py-2">
    <span className="font-medium text-gray-600">{title}:</span>
    <span className="ml-2">{value ?? 'N/A'}</span>
  </div>
)

const ProviderOverviewSkeleton: React.FC = () => (
  <div className="p-4 border rounded">
    <Skeleton className="h-6 w-1/4 mb-4" />
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border-b py-2">
          <Skeleton className="h-5 w-1/3 inline-block mr-2" />
          <Skeleton className="h-5 w-1/2 inline-block" />
        </div>
      ))}
    </div>
  </div>
)
