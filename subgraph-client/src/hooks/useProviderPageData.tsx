// src/hooks/useProviderPageData.tsx
import { useMemo } from 'react';
import useGraphQL from './useGraphQL';
import {
  providerWithProofSetsQuery, // Using the one that fetches proof sets directly
  weeklyProviderActivitiesQuery,
} from '@/utility/queries';
import type { Provider, WeeklyProviderActivity } from '@/utility/types';

// Helper to convert string ID to hex format if needed (assuming address is already hex)
// function toEvenLengthHex(numStr: string): string {
//   if (!numStr) return '';
//   let hex = Number(numStr).toString(16);
//   if (hex.length % 2 !== 0) {
//     hex = '0' + hex;
//   }
//   return '0x' + hex;
// }

interface ProviderPageOptions {
  proofSetItemsPerPage?: number;
  activityLimit?: number; // How many weeks of activity to fetch
  retryOnError?: boolean;
}

export function useProviderPageData(
  providerId: string | undefined, // Provider ID (address) from URL
  proofSetPage = 1,
  options: ProviderPageOptions = {}
) {
  const proofSetItemsPerPage = options.proofSetItemsPerPage || 10;
  const activityLimit = options.activityLimit || 10; // Default to last 10 weeks

  // Validate providerId (basic check - should be a hex string)
  const isValidProviderId = useMemo(() => 
    providerId && /^0x[a-fA-F0-9]+$/.test(providerId)
  , [providerId]);

  // Provider details and their paginated proof sets
  const { 
    data: providerData, 
    error: providerError, 
    isLoading: providerLoading 
  } = useGraphQL<{ provider: Provider }>( 
    providerWithProofSetsQuery, // Use the query that includes proof sets
    {
      providerId: isValidProviderId ? providerId : '', // Pass ID only if valid
      // Pagination for proof sets within the provider query (if supported by schema)
      // Assuming the schema supports first/skip on the nested proofSets field
      // If not, this part needs adjustment or a separate query
      firstProofSets: proofSetItemsPerPage,
      skipProofSets: (proofSetPage - 1) * proofSetItemsPerPage,
    },
    { 
      errorRetryCount: options.retryOnError ? 3 : 0, 
      revalidateOnFocus: false, // Data likely stable
    }
  );

  // Weekly activity data
  const { 
    data: activityData, 
    error: activityError, 
    isLoading: activityLoading 
  } = useGraphQL<{ weeklyProviderActivities: WeeklyProviderActivity[] }>( 
    weeklyProviderActivitiesQuery,
    {
      // Filter by provider ID and limit results (e.g., last 10 weeks)
      where: { providerId: isValidProviderId ? providerId : '' },
      orderBy: 'id', // Assuming 'id' represents the week/time
      orderDirection: 'desc',
      first: activityLimit, // Limit to N most recent activity records
    },
    { 
      errorRetryCount: options.retryOnError ? 2 : 0, 
      revalidateOnFocus: false,
    }
  );

  const provider = providerData?.provider;
  const activities = activityData?.weeklyProviderActivities || [];

  // Calculate total proof sets safely
  const totalProofSets = provider ? Number(provider.totalProofSets) : 0;

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
  };
}

export default useProviderPageData;
