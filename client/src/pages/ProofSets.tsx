import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProofSets, ProofSet } from '@/api/apiService'
import { Input } from '@/components/ui/input'
import {
  Search,
  Database,
  CheckCircle,
  Clock,
  HardDrive,
  User,
  Shield,
  Calendar,
} from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDataSize } from '@/utility/helper'

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Proof Sets</h1>
            <p className="text-gray-500 mt-1">
              Browse and search through all proof sets
            </p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by ID or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Proof Set ID
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    Owner
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    Status
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Total Roots
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    Proved Roots
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" />
                    Data Size
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Last Proof
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Next Challenge
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proofSets.map((proofSet) => (
                <tr
                  key={proofSet.setId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link
                      to={`/proofsets/${proofSet.setId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {proofSet.setId}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/providers/${proofSet.owner}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {proofSet.owner}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        proofSet.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {proofSet.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {proofSet.totalRoots}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        proofSet.totalProvedRoots === 0
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {proofSet.totalProvedRoots || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {formatDataSize(proofSet.totalDataSize)}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {proofSet.lastProvenEpoch
                      ? proofSet.lastProvenEpoch.toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {proofSet.nextChallengeEpoch
                      ? proofSet.nextChallengeEpoch.toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {proofSets.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No proof sets found</p>
          </div>
        )}
        {totalProofSets > ITEMS_PER_PAGE && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalProofSets / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
