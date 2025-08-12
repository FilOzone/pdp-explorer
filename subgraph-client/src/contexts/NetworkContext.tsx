import { createContext, useContext, ReactNode, useEffect } from 'react'
import useLocalStorage from '@/hooks/useLocalStorage'
import { useLocation, useNavigate } from 'react-router-dom'

export type Network = 'mainnet' | 'calibration'

interface NetworkContextType {
  network: Network
  setNetwork: (network: Network) => void
  subgraphUrl: string
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [network, setNetwork] = useLocalStorage<Network>(
    'pdp-network',
    'mainnet'
  )
  const location = useLocation()
  const navigate = useNavigate()

  const getSubgraphUrl = (network: Network) => {
    const PROJECT_ID = import.meta.env.VITE_GOLDSKY_PROJECT_ID || ''
    const PROJECT_NAME = import.meta.env.VITE_GOLDSKY_PROJECT_NAME || 'pdp'

    const versions = {
      mainnet:
        import.meta.env.VITE_GOLDSKY_MAINNET_SUBGRAPH_VERSION || 'mainnet',
      calibration:
        import.meta.env.VITE_GOLDSKY_CALIBRATION_SUBGRAPH_VERSION ||
        'calibration',
    }

    if (network === 'calibration') {
      return `https://pdpsql.vxb.ai/subgraphs/name/pd/${PROJECT_NAME}`
    }
    return `https://api.goldsky.com/api/public/${PROJECT_ID}/subgraphs/${PROJECT_NAME}/${versions[network]}/gn`
  }

  const subgraphUrl = getSubgraphUrl(network)

  // Handle network parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const networkParam = params.get('network')?.toLowerCase()

    if (
      networkParam &&
      (networkParam === 'mainnet' || networkParam === 'calibration') &&
      networkParam !== network
    ) {
      setNetwork(networkParam)

      // Remove the network parameter from URL after processing
      params.delete('network')
      const newSearch = params.toString() ? `?${params.toString()}` : ''
      const newPath = location.pathname + newSearch + location.hash
      navigate(newPath, { replace: true })
    }
  }, [location.search, network, setNetwork, navigate])

  // Handle network-specific paths
  useEffect(() => {
    const path = location.pathname
    const pathParts = path.split('/')

    // If the path already starts with a network identifier, update local state
    if (
      (pathParts[1] === 'mainnet' || pathParts[1] === 'calibration') &&
      pathParts[1] !== network
    ) {
      setNetwork(pathParts[1] as Network)
    }
  }, [location.pathname, network, navigate])

  return (
    <NetworkContext.Provider value={{ network, setNetwork, subgraphUrl }}>
      {children}
    </NetworkContext.Provider>
  )
}

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
