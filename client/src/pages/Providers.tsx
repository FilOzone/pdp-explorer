import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProviders, Provider } from '@/api/apiService'

export const Providers = () => {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Call the API service to fetch providers
    getProviders(0, 10)
      .then((response) => {
        setProviders(response.data || [])
      })
      .catch((error) => console.error('Error fetching providers:', error))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Storage Providers</h1>
      <div className="grid gap-4">
        {providers.map((provider) => (
          <Link
            key={provider.providerId}
            to={`/providers/${provider.providerId}`}
            className="p-4 border rounded hover:bg-gray-50"
          >
            <h2 className="text-xl font-semibold">
              Provider {provider.providerId}
            </h2>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>Active Proof Sets: {provider.activeProofSets}</div>
              <div>
                Data Stored:{' '}
                {(provider.dataSizeStored / 1024 / 1024 / 1024).toFixed(2)} GB
              </div>
              <div>Roots: {provider.numRoots}</div>
              <div>
                First Seen: {new Date(provider.firstSeen).toLocaleDateString()}
              </div>
              <div>
                Last Seen: {new Date(provider.lastSeen).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
