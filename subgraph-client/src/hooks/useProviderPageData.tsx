import { useMemo } from 'react'
import useGraphQL from './useGraphQL'
import {
  providerWithProofSetsQuery,
  weeklyProviderActivitiesQuery,
} from '@/utility/queries'
import type { Provider, WeeklyProviderActivity } from '@/utility/types'

interface ProviderPageOptions {
  proofSetItemsPerPage?: number
  activityLimit?: number
  retryOnError?: boolean
}

export function useProviderPageData(
  providerId: string | undefined, // Provider ID (address) from URL
  proofSetPage = 1,
  options: ProviderPageOptions = {}
) {
  const proofSetItemsPerPage = options.proofSetItemsPerPage || 10
  const activityLimit = options.activityLimit || 12

  // Validate providerId (basic check - should be a hex string)
  const isValidProviderId = useMemo(
    () => providerId && /^0x[a-fA-F0-9]+$/.test(providerId),
    [providerId]
  )

  // Provider details and their paginated proof sets
  const {
    data: providerData,
    error: providerError,
    isLoading: providerLoading,
  } = useGraphQL<{ provider: Provider }>(
    providerWithProofSetsQuery,
    {
      providerId: isValidProviderId ? providerId : '',
      first: proofSetItemsPerPage,
      skip: (proofSetPage - 1) * proofSetItemsPerPage,
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
      where: { providerId: isValidProviderId ? providerId : '' },
      orderBy: 'id',
      orderDirection: 'desc',
      first: activityLimit,
    },
    {
      errorRetryCount: options.retryOnError ? 2 : 0,
      revalidateOnFocus: false,
    }
  )

  const provider = providerData?.provider
  const activities = activityData?.weeklyProviderActivities || []

  // Calculate total proof sets safely
  const totalProofSets = provider ? Number(provider.totalProofSets) : 0

  return {
    // Data
    provider,
    activities,
    totalProofSets,
    isValidProviderId,

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

export default useProviderPageData
