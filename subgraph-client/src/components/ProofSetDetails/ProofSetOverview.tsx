import React from 'react'
import { Link } from 'react-router-dom'
import { DataSet } from '@/utility/types'
import { formatDataSize, formatTokenAmount, formatDate } from '@/utility/helper'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface ProofSetOverviewProps {
  proofSet?: DataSet
  isLoading: boolean
  error: any
}

export const ProofSetOverview: React.FC<ProofSetOverviewProps> = ({
  proofSet,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <ProofSetOverviewSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Overview</AlertTitle>
        <AlertDescription>
          Could not load proof set details. Error:{' '}
          {error.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!proofSet) {
    return (
      <Alert variant="default" className="mb-4">
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          Proof set details could not be found.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Overview</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Owner:</span>
          <Link
            to={`/providers/${proofSet.owner.address}`}
            className="text-blue-500 hover:underline"
          >
            {proofSet.owner.address}
          </Link>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Listener Address:</span>
          <span>{proofSet.listener}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Status:</span>
          <span>{proofSet.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Total Pieces:</span>
          <span>{proofSet.totalRoots || 0}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Total Pieces Proved:</span>
          <span>{proofSet.totalProvedRoots || 0}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Data Size:</span>
          <span>{formatDataSize(proofSet.totalDataSize)}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Total Fee Paid:</span>
          <span>{formatTokenAmount(proofSet.totalFeePaid)}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Faulted Periods:</span>
          <span>{proofSet.totalFaultedPeriods}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Last Proven:</span>
          <span>
            {proofSet.lastProvenEpoch !== '0'
              ? Number(proofSet.lastProvenEpoch).toLocaleString()
              : 'Never'}
          </span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Next Challenge:</span>
          <span>
            {proofSet.nextChallengeEpoch !== '0'
              ? Number(proofSet.nextChallengeEpoch).toLocaleString()
              : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Challenge Range:</span>
          <span>{proofSet.challengeRange || 'N/A'}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <span className="font-medium">Created At:</span>
          <span>{formatDate(proofSet.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

const ProofSetOverviewSkeleton: React.FC = () => (
  <div className="p-4 border rounded">
    <Skeleton className="h-6 w-1/4 mb-4" />
    <div className="grid grid-cols-2 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex justify-between border-b py-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  </div>
)
