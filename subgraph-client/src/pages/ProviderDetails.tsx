import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ProviderOverviewCard } from '@/components/ProviderDetails/ProviderOverviewCard'
import { ProviderActivityChart } from '@/components/ProviderDetails/ProviderActivityChart'
import { ProviderProofSetsTable } from '@/components/ProviderDetails/ProviderProofSetsTable'
import useProviderPageData from '@/hooks/useProviderPageData'
import GoBackLink from '@/components/go-back'

export const ProviderDetails = () => {
  const ITEMS_PER_PAGE = 10
  const { providerId } = useParams<string>()
  const [proofSetPage, setProofSetPage] = useState(1)

  const {
    provider,
    activities,
    totalProofSets,
    isValidProviderId,
    isLoading,
    errors,
  } = useProviderPageData(providerId, proofSetPage, {
    proofSetItemsPerPage: ITEMS_PER_PAGE,
    retryOnError: true,
  })

  // Handle invalid ID early
  if (providerId && !isValidProviderId && !isLoading.details) {
    return <div className="p-4 text-red-500">Invalid Provider ID format.</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <GoBackLink />
      </div>
      <div className="flex items-center gap-2 mb-4">
        {/* Show title only when details are loaded/loading, not on invalid ID state */}
        {providerId && isValidProviderId && (
          <h1 className="text-2xl font-bold truncate">
            Provider: {providerId}
          </h1>
        )}
      </div>
      <div className="grid gap-4">
        <ProviderOverviewCard
          provider={provider}
          isLoading={isLoading.details}
          error={errors.details}
        />

        <ProviderActivityChart
          activities={activities}
          isLoading={isLoading.activity}
          error={errors.activity}
        />

        <ProviderProofSetsTable
          proofSets={provider?.proofSets ?? []}
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
