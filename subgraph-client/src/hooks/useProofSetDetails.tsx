import { useEffect, useState, useMemo } from 'react'
import useGraphQL from './useGraphQL'
import {
  proofSetQuery,
  rootsQuery,
  transactionsQuery,
  eventLogsQuery,
  weeklyProofSetActivitiesQuery,
} from '@/utility/queries'
import type {
  ProofSet,
  Root,
  Transaction,
  EventLog,
  WeeklyProofSetActivity,
} from '@/utility/types'

// Helper to convert string ID to hex format for GraphQL
function toEvenLengthHex(numStr: string): string {
  if (!numStr) return ''
  let hex = Number(numStr).toString(16)
  if (hex.length % 2 !== 0) {
    hex = '0' + hex
  }
  return '0x' + hex
}

interface ProofSetDetailsOptions {
  rootsPerPage?: number
  itemsPerPage?: number
  retryOnError?: boolean
  activityLimit?: number
}

export function useProofSetDetails(
  proofSetId: string | undefined,
  currentRootsPage = 1,
  currentPage = 1,
  methodFilter = 'All Methods',
  eventFilter = 'All Events',
  options: ProofSetDetailsOptions = {}
) {
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false)
  const [totalRoots, setTotalRoots] = useState(options.rootsPerPage || 100)

  const rootsPerPage = options.rootsPerPage || 100
  const itemsPerPage = options.itemsPerPage || 10
  const activityLimit = options.activityLimit || 10

  const hexProofSetId = useMemo(
    () => (proofSetId ? toEvenLengthHex(proofSetId) : ''),
    [proofSetId]
  )

  // Main ProofSet data
  const {
    data: proofSetData,
    error: proofSetError,
    isLoading: proofSetLoading,
  } = useGraphQL<{ proofSet: ProofSet }>(
    proofSetQuery,
    {
      proofSetId: hexProofSetId,
      first: itemsPerPage,
      skip: (currentRootsPage - 1) * itemsPerPage,
    },
    { errorRetryCount: options.retryOnError ? 3 : 0 }
  )

  // Transactions data
  const {
    data: txsData,
    error: txsError,
    isLoading: txsLoading,
  } = useGraphQL<{ transactions: Transaction[] }>(
    transactionsQuery,
    {
      first: itemsPerPage,
      skip: (currentPage - 1) * itemsPerPage,
      where: {
        proofSetId,
        method_contains_nocase:
          methodFilter === 'All Methods' ? '' : methodFilter,
      },
    },
    { errorRetryCount: options.retryOnError ? 2 : 0 }
  )

  // Event logs data
  const {
    data: logsData,
    error: logsError,
    isLoading: logsLoading,
  } = useGraphQL<{ eventLogs: EventLog[] }>(
    eventLogsQuery,
    {
      first: itemsPerPage,
      skip: (currentPage - 1) * itemsPerPage,
      where: {
        setId: proofSetId,
        name_contains_nocase: eventFilter === 'All Events' ? '' : eventFilter,
      },
    },
    { errorRetryCount: options.retryOnError ? 2 : 0 }
  )

  // Heatmap roots data
  const {
    data: heatmapData,
    error: heatmapError,
    isLoading: heatmapLoading,
  } = useGraphQL<{ roots: Root[] }>(
    rootsQuery,
    {
      first: isHeatmapExpanded ? totalRoots : rootsPerPage,
      skip: 0,
      where: { setId: proofSetId },
    },
    { errorRetryCount: options.retryOnError ? 2 : 0 }
  )

  // Weekly activity data
  const {
    data: activityData,
    error: activityError,
    isLoading: activityLoading,
  } = useGraphQL<{ weeklyProofSetActivities: WeeklyProofSetActivity[] }>(
    weeklyProofSetActivitiesQuery,
    {
      where: { proofSetId },
      orderBy: 'id', // Assuming 'id' represents the week/time
      orderDirection: 'desc',
      first: activityLimit, // Limit to N most recent activity records
    },
    {
      errorRetryCount: options.retryOnError ? 2 : 0,
      revalidateOnFocus: false,
    }
  )

  // Update total roots when proofSet data is loaded
  useEffect(() => {
    if (proofSetData?.proofSet) {
      setTotalRoots(Number(proofSetData.proofSet.totalRoots))
    }
  }, [proofSetData])

  return {
    // Data
    proofSet: proofSetData?.proofSet,
    transactions: txsData?.transactions || [],
    eventLogs: logsData?.eventLogs || [],
    heatmapRoots: heatmapData?.roots || [],
    activities: activityData?.weeklyProofSetActivities || [],

    // Loading states
    isLoading: {
      proofSet: proofSetLoading,
      transactions: txsLoading,
      eventLogs: logsLoading,
      heatmap: heatmapLoading,
      activity: activityLoading,
      any: proofSetLoading || txsLoading || logsLoading || heatmapLoading,
    },

    // Error states
    errors: {
      proofSet: proofSetError,
      transactions: txsError,
      eventLogs: logsError,
      heatmap: heatmapError,
      activity: activityError,
      any: proofSetError || txsError || logsError || heatmapError,
    },

    // Heatmap state
    isHeatmapExpanded,
    setIsHeatmapExpanded,
    totalRoots,

    // Metadata
    totalTransactions: proofSetData?.proofSet?.totalTransactions || '0',
    totalEventLogs: proofSetData?.proofSet?.totalEventLogs || '0',
  }
}

export default useProofSetDetails
