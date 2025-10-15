import React from 'react'
import { RootData } from '@/utility/types'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface PieceOverviewCardProps {
  pieceDetails?: RootData[]
  isLoading: boolean
  error: any
}

export const PieceOverviewCard: React.FC<PieceOverviewCardProps> = ({
  pieceDetails,
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

  if (!pieceDetails) {
    return (
      <Alert variant="default" className="mb-4">
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          Provider details could not be found.
        </AlertDescription>
      </Alert>
    )
  }

  function getDatesetCount(pieceDetails: RootData[]) {
    const uniqueSetIds = new Set<string>();
    pieceDetails.forEach(piece => {
      uniqueSetIds.add(piece.setId);
    });
    return uniqueSetIds.size;
  }

  function getProviderCount(pieceDetails: RootData[]) {
    const uniqueProviderIds = new Set<string>();
    pieceDetails.forEach(piece => {
      uniqueProviderIds.add(piece.proofSet.owner.address);
    });
    return uniqueProviderIds.size;
  }

  function getLastUpdatedTime(pieceDetails: RootData[]) {
    const lastUpdatedTime
      = pieceDetails.reduce((prev, current) => {
        const timestamp = Number(current.proofSet.updatedAt);
        if (!isNaN(timestamp)) {
          const currentTime = new Date(timestamp * 1000);
          return currentTime > prev ? currentTime : prev;
        } else {
          return prev;
        }
      }, new Date(0));
    return lastUpdatedTime.toLocaleString();
  }

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Overview</h2>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem title="Total Data Sets" value={getDatesetCount(pieceDetails)} />
        <InfoItem title="Total Provider Count" value={getProviderCount(pieceDetails)} />
        <InfoItem title="Last Proving Time" value={getLastUpdatedTime(pieceDetails)} />
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
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex justify-between border-b py-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  </div>
)
