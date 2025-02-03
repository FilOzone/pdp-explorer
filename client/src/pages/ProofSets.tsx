import { dummyProofSets } from '@/data/dummyData'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export const ProofSets = () => {
  const [proofSets, setProofSets] = useState(dummyProofSets.data)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setProofSets(dummyProofSets.data)
      setLoading(false)
    }, 1000)
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
              <div>Provider: {proofSet.providerId}</div>
              <div>Size: {(proofSet.size / 1024 / 1024).toFixed(2)} MB</div>
              <div>Proofs Submitted: {proofSet.proofsSubmitted}</div>
              <div>Faults: {proofSet.faults}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
