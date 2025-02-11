import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProofSets, ProofSet } from '@/api/apiService'

export const ProofSets = () => {
  const [proofSets, setProofSets] = useState<ProofSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProofSets('proofsSubmitted', 'desc', 0, 10)
      .then((response) => {
        setProofSets(response.data || [])
      })
      .catch((error) => console.error('Error fetching proof sets:', error))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Proof Sets</h1>
      <div className="grid gap-4">
        {proofSets.map((proofSet) => (
          <Link
            key={proofSet.proofSetId}
            to={`/proofsets/${proofSet.proofSetId}`}
            className="p-4 border rounded hover:bg-gray-50"
          >
            <h2 className="text-xl font-semibold">
              Proof Set {proofSet.proofSetId}
            </h2>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>Status: {proofSet.status ? 'Active' : 'Inactive'}</div>
              <div>Root #: {proofSet.numRoots}</div>
              <div>
                Created: {new Date(proofSet.createdAt).toLocaleDateString()}
              </div>
              <div>
                Last Proof:{' '}
                {new Date(proofSet.lastProofReceived).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
