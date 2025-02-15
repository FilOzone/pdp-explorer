import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProofSets, ProofSet } from '@/api/apiService'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/useDebounce'

export const ProofSets = () => {
  const [proofSets, setProofSets] = useState<ProofSet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProofSets, setTotalProofSets] = useState(0)
  const ITEMS_PER_PAGE = 10

  const debouncedSearch = useDebounce(searchQuery, 300)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [debouncedSearch])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getProofSets(
          'proofsSubmitted',
          'desc',
          (currentPage - 1) * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE,
          debouncedSearch
        )
        setProofSets(response.data || [])
        setTotalProofSets(response.metadata.total)
      } catch (error) {
        console.error('Error fetching proof sets:', error)
        setProofSets([])
        setTotalProofSets(0)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentPage, debouncedSearch])

  const formatDataSize = (size: string) => {
    if (!size || size === '0') return 'NaN GB'
    return `${(Number(size) / 1024 ** 3).toFixed(2)} GB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Proof Sets</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search by ID or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="border rounded">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium">Proof Set ID</th>
                <th className="text-left p-4 font-medium">Owner</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Total Roots</th>
                <th className="text-left p-4 font-medium">Proved Roots</th>
                <th className="text-left p-4 font-medium">Data Size</th>
                <th className="text-left p-4 font-medium">Last Proof</th>
                <th className="text-left p-4 font-medium">Next Challenge</th>
              </tr>
            </thead>
            <tbody>
              {proofSets.map((proofSet) => (
                <tr key={proofSet.setId} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Link
                      to={`/proofsets/${proofSet.setId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {proofSet.setId}
                    </Link>
                  </td>
                  <td className="p-4">
                    <Link
                      to={`/providers/${proofSet.owner}`}
                      className="text-blue-500 hover:underline"
                    >
                      {proofSet.owner}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        proofSet.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {proofSet.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">{proofSet.totalRoots}</td>
                  <td className="p-4">
                    <span
                      className={
                        proofSet.totalProvedRoots === 0
                          ? 'text-gray-500'
                          : undefined
                      }
                    >
                      {proofSet.totalProvedRoots || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    {formatDataSize(proofSet.totalDataSize)}
                  </td>
                  <td className="p-4">
                    <span className="text-gray-500">
                      {proofSet.lastProvenEpoch > 0
                        ? new Date(
                            proofSet.lastProvenEpoch * 1000
                          ).toLocaleString()
                        : 'Never'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-gray-500">
                      {proofSet.nextChallengeEpoch > 0
                        ? new Date(
                            proofSet.nextChallengeEpoch * 1000
                          ).toLocaleString()
                        : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalProofSets > ITEMS_PER_PAGE && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}
