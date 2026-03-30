import { parseCidToHex } from '@/utility/helper'
import useGraphQL from './useGraphQL'
import {
  pieceDetailsQuery,
  weeklyProviderActivitiesQuery,
} from '@/utility/queries'
import type { RootData, WeeklyProviderActivity } from '@/utility/types'

interface PiecePageOptions {
  activityLimit?: number
  retryOnError?: boolean
}

export function usePiecePageData(
  pieceId: string | undefined, // Piece ID from URL
  options: PiecePageOptions = {}
) {
  const activityLimit = options.activityLimit || 12

  // Validate providerId (basic check - should be a hex string)
  const isValidPieceId = parseCidToHex(pieceId || '') !== null;

  // Provider details and their paginated proof sets
  const {
    data: dataRoots,
    error: providerError,
    isLoading: providerLoading,
  } = useGraphQL<{ roots: RootData[] }>(
    pieceDetailsQuery,
    {
      cid: isValidPieceId ? parseCidToHex(pieceId || '') : '',
    },
    {
      errorRetryCount: options.retryOnError ? 3 : 0,
      revalidateOnFocus: false,
    }
  )

  // Weekly activity data
  const {
    data: activityData,
    error: activityError,
    isLoading: activityLoading,
  } = useGraphQL<{ weeklyProviderActivities: WeeklyProviderActivity[] }>(
    weeklyProviderActivitiesQuery,
    {
      where: { pieceId: isValidPieceId ? pieceId : '' },
      orderBy: 'id',
      orderDirection: 'desc',
      first: activityLimit,
    },
    {
      errorRetryCount: options.retryOnError ? 2 : 0,
      revalidateOnFocus: false,
    }
  )
  const pieceDetails = dataRoots?.roots
  const activities = activityData?.weeklyProviderActivities || []

  const uniqueSetIds = new Set<string>()
  pieceDetails && pieceDetails.length > 0 && pieceDetails.forEach(piece => {
    uniqueSetIds.add(piece.setId)
  })
  // Calculate total proof sets safely
  const totalProofSets = uniqueSetIds.size

  return {
    // Data
    pieceDetails,
    activities,
    totalProofSets,
    isValidPieceId,

    // Loading states
    isLoading: {
      details: providerLoading,
      activity: activityLoading,
      any: providerLoading || activityLoading,
    },

    // Error states
    errors: {
      details: providerError,
      activity: activityError,
      any: providerError || activityError,
    },
  }
}

export default usePiecePageData
