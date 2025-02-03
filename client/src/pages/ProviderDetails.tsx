import { dummyProviders } from '@/data/dummyData'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export const ProviderDetails = () => {
  const { providerId } = useParams()
  const [provider, setProvider] = useState(dummyProviders.data[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const found = dummyProviders.data.find((p) => p.providerId === providerId)
      if (found) setProvider(found)
      setLoading(false)
    }, 1000)
  }, [providerId])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        Provider Details: {providerId}
      </h1>
      <div className="grid gap-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>Active Proof Sets: {provider.activeProofSets}</div>
            <div>
              Data Stored:{' '}
              {(provider.dataSizeStored / 1024 / 1024 / 1024).toFixed(2)} GB
            </div>
            <div>Faults: {provider.faults}</div>
            <div>
              First Seen: {new Date(provider.firstSeen).toLocaleDateString()}
            </div>
            <div>
              Last Seen: {new Date(provider.lastSeen).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
