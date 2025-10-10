import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PieceOverviewCard } from '@/components/PieceDetails/PieceOverviewCard'
import { PieceDataSetsTable } from '@/components/PieceDetails/PieceDataSetsTable'
import usePiecePageData from '@/hooks/usePiecePageData'
import GoBackLink from '@/components/go-back'

export const PieceDetails = () => {
  const ITEMS_PER_PAGE = 10
  const { cid } = useParams<string>()
  const [proofSetPage, setProofSetPage] = useState(1)

  const {
    pieceDetails,
    totalProofSets,
    isValidPieceId,
    isLoading,
    errors,
  } = usePiecePageData(cid, proofSetPage, {
    proofSetItemsPerPage: ITEMS_PER_PAGE,
    retryOnError: true,
  })

  function filterDuplicateRootData() {
    return pieceDetails?.filter(
      (rootData, index, self) =>
        index === self.findIndex((t) => t.setId === rootData.setId)
    )
  }

  // Handle invalid ID early
  if (cid && !isValidPieceId && !isLoading.details) {
    return <div className="p-4 text-red-500">Invalid Piece ID format.</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <GoBackLink />
      </div>
      <div className="flex items-center gap-2 mb-4">
        {/* Show title only when details are loaded/loading, not on invalid ID state */}
        {cid && isValidPieceId && (
          <h1 className="text-2xl font-bold truncate">
            Piece Id: {cid}
          </h1>
        )}
      </div>
      <div className="grid gap-4">
        <PieceOverviewCard
          pieceDetails={pieceDetails}
          isLoading={isLoading.details}
          error={errors.details}
        />

        <PieceDataSetsTable
          rootsData={filterDuplicateRootData()}
          totalProofSets={totalProofSets}
          isLoading={isLoading.details}
          error={errors.details}
          currentPage={proofSetPage}
          onPageChange={setProofSetPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </div>
  )
}
