import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ProofSetsTable } from "@/components/ProofSets/ProofSetsTable";
import PageHeader from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import useGraphQL from "@/hooks/useGraphQL";
import { useValidatedNumberDebounce } from "@/hooks/useValidatedNumberDebounce";
import { landingProofSetsQuery, networkMetricsQuery } from "@/utility/queries";
import type { DataSet, NetworkMetrics } from "@/utility/types";

const ITEMS_PER_PAGE = 10;

export const ProofSets = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const { validatedSearch, searchError } = useValidatedNumberDebounce(searchQuery, 300);
  const { data: metricsData, error: metricsError } = useGraphQL<{
    networkMetric: NetworkMetrics;
  }>(networkMetricsQuery, undefined, { revalidateOnFocus: false });

  const {
    data: proofSetsData,
    error: proofSetsError,
    isLoading: proofSetsLoading,
  } = useGraphQL<{ dataSets: DataSet[] }>(
    landingProofSetsQuery,
    {
      first: ITEMS_PER_PAGE,
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      where: {},
      orderBy: "createdAt",
      orderDirection: "desc",
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    },
  );

  const dataSets = proofSetsData?.dataSets || [];
  const totalProofSets = parseInt(metricsData?.networkMetric?.totalProofSets || "0", 10);
  const totalPages = Math.max(1, Math.ceil(totalProofSets / ITEMS_PER_PAGE)) || 0;

  // Reset page to 1 when search query changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed off the debounced `validatedSearch`, not raw `searchQuery`
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1);
    }
  }, [validatedSearch]); // intentionally keyed off the debounced value

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Data Sets</h1>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="search"
          placeholder="Search by Data Set ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`pl-8 ${searchError ? "border-red-500" : ""}`}
        />
      </div>
      {searchError && <div className="text-red-500 text-sm mt-1 mb-4">{searchError}</div>}
      <div className="border rounded mb-4">
        {metricsError && (
          <div className="p-2 text-xs text-red-600 bg-red-50 border-b">Could not load total proof set count.</div>
        )}
        <ProofSetsTable
          dataSets={dataSets}
          isLoading={proofSetsLoading}
          error={proofSetsError}
          searchQuery={validatedSearch}
        />
      </div>
      {!validatedSearch && totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
};
