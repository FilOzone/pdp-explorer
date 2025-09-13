import { useEffect, useState } from 'react'
import useGraphQL from './useGraphQL'
import {
  proofSetQuery,
  rootsQuery,
  transactionsQuery,
  eventLogsQuery,
  weeklyProofSetActivitiesQuery,
} from '@/utility/queries'
import type {
  DataSet,
  Root,
  Transaction,
  EventLog,
  WeeklyProofSetActivity,
} from '@/utility/types'

interface ProofSetDetailsOptions {
  initialRootsPerPage?: number
  itemsPerPage?: number
  maxHeatmapRootsPerPage?: number
  retryOnError?: boolean
  activityLimit?: number
}

export function useProofSetDetails(
  dataSetId: string | undefined,
  currentRootsPage = 1,
  currentPage = 1,
  currentHeatmapPage = 1,
  methodFilter = 'All Methods',
  eventFilter = 'All Events',
  options: ProofSetDetailsOptions = {}
) {
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false)
  const [totalRoots, setTotalRoots] = useState(
    options.initialRootsPerPage || 100
  )

  const initialRootsPerPage = options.initialRootsPerPage || 100
  const maxHeatmapRootsPerPage = options.maxHeatmapRootsPerPage || 500
  const itemsPerPage = options.itemsPerPage || 10
  const activityLimit = options.activityLimit || 10

  // Main DataSet data
  const {
    data: proofSetData,
    error: proofSetError,
    isLoading: proofSetLoading,
  } = useGraphQL<{ dataSets: DataSet[] }>(
    proofSetQuery,
    {
      where: { setId: dataSetId },
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
        dataSetId,
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
        setId: dataSetId,
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
      first: isHeatmapExpanded
        ? totalRoots > maxHeatmapRootsPerPage
          ? maxHeatmapRootsPerPage
          : totalRoots
        : initialRootsPerPage,
      skip: isHeatmapExpanded
        ? totalRoots > maxHeatmapRootsPerPage
          ? (currentHeatmapPage - 1) * maxHeatmapRootsPerPage
          : 0
        : 0,
      where: { setId: dataSetId },
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
      where: { dataSetId },
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
    if (proofSetData?.dataSets?.length > 0) {
      setTotalRoots(Number(proofSetData.dataSets[0].totalRoots))
    }
  }, [proofSetData])

  return {
    // Data
    proofSet: proofSetData?.dataSets?.[0],
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
    totalTransactions: proofSetData?.dataSets?.[0]?.totalTransactions || '0',
    totalEventLogs: proofSetData?.dataSets?.[0]?.totalEventLogs || '0',
  }
}

export default useProofSetDetails
