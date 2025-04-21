import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ProofSetOverview } from '@/components/ProofSetDetails/ProofSetOverview'
import { RootsTable } from '@/components/ProofSetDetails/RootsTable'
import { ActivityTabs } from '@/components/ProofSetDetails/ActivityTabs'
import { HeatmapSection } from '@/components/ProofSetDetails/HeatmapSection'
import useProofSetDetails from '@/hooks/useProofSetDetails'
import { ProofSetActivityChart } from '@/components/ProofSetDetails/ProofSetActivityChart'

const ITEMS_PER_PAGE = 10
const ROOTS_PER_PAGE = 100

export const ProofSetDetails = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [currentRootsPage, setCurrentRootsPage] = useState(1)
  const [methodFilter, setMethodFilter] = useState('All Methods')
  const [eventFilter, setEventFilter] = useState('All Events')
  const { proofSetId } = useParams<string>()

  // Basic ID Validation
  if (!proofSetId || !/^\d+$/.test(proofSetId)) {
    return (
      <div className="p-4 text-red-500">Invalid Proof Set ID provided.</div>
    )
  }

  const {
    proofSet,
    transactions,
    eventLogs,
    heatmapRoots,
    activities,
    isHeatmapExpanded,
    isLoading, // { proofSet, transactions, eventLogs, heatmap, any }
    errors, // { proofSet, transactions, eventLogs, heatmap, any }
    totalRoots,
    totalEventLogs,
    totalTransactions,
    setIsHeatmapExpanded,
  } = useProofSetDetails(
    proofSetId,
    currentRootsPage,
    currentPage,
    methodFilter,
    eventFilter,
    {
      itemsPerPage: ITEMS_PER_PAGE,
      rootsPerPage: ROOTS_PER_PAGE,
      retryOnError: true,
    }
  )

  // Handler to reset pagination when filters change
  const handleMethodFilterChange = (newFilter: string) => {
    setCurrentPage(1) // Reset page for transactions
    setMethodFilter(newFilter)
  }

  const handleEventFilterChange = (newFilter: string) => {
    setCurrentPage(1) // Reset page for event logs
    setEventFilter(newFilter)
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/proofsets" className="text-blue-500 hover:underline">
          ← Back to Proof Sets
        </Link>
        {/* Show title only if core proofSet data loaded, avoid showing before ID is confirmed valid */}
        {proofSet && (
          <h1 className="text-2xl font-bold">
            Proof Set Details: {proofSetId}
          </h1>
        )}
      </div>
      <div className="grid gap-4">
        <ProofSetOverview
          proofSet={proofSet}
          isLoading={isLoading.proofSet}
          error={errors.proofSet}
        />

        <ProofSetActivityChart
          activities={activities}
          isLoading={isLoading.activity}
          error={errors.activity}
        />

        <HeatmapSection
          heatmapRoots={heatmapRoots}
          totalRoots={totalRoots}
          isLoading={isLoading.heatmap}
          error={errors.heatmap}
          isHeatmapExpanded={isHeatmapExpanded}
          setIsHeatmapExpanded={setIsHeatmapExpanded}
        />

        <RootsTable
          roots={proofSet?.roots ?? []} // Pass roots from proofSet data
          totalRoots={totalRoots}
          isLoading={isLoading.proofSet} // Loading depends on the main proofSet query
          error={errors.proofSet} // Error depends on the main proofSet query
          currentPage={currentRootsPage}
          onPageChange={setCurrentRootsPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />

        <ActivityTabs
          transactions={transactions}
          eventLogs={eventLogs}
          totalTransactions={totalTransactions}
          totalEventLogs={totalEventLogs}
          isLoadingTransactions={isLoading.transactions}
          errorTransactions={errors.transactions}
          isLoadingEventLogs={isLoading.eventLogs}
          errorEventLogs={errors.eventLogs}
          methodFilter={methodFilter}
          onMethodFilterChange={handleMethodFilterChange}
          eventFilter={eventFilter}
          onEventFilterChange={handleEventFilterChange}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </div>
  )
}
