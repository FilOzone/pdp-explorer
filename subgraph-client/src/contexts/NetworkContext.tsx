import { createContext, useContext, ReactNode } from 'react'
import useLocalStorage from '@/hooks/useLocalStorage'

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

    return `https://api.goldsky.com/api/public/${PROJECT_ID}/subgraphs/${PROJECT_NAME}/${versions[network]}/gn`
  }

  const subgraphUrl = getSubgraphUrl(network)

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
