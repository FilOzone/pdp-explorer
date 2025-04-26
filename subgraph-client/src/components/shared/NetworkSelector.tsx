import { useState } from 'react'
import { useNetwork, Network } from '@/contexts/NetworkContext'

export const NetworkSelector = () => {
  const { network, setNetwork } = useNetwork()
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = () => setIsOpen(!isOpen)
  const closeDropdown = () => setIsOpen(false)

  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork)
    closeDropdown()
  }

  // Network display names and colors
  const networkConfig = {
    mainnet: {
      name: 'Filecoin Mainnet',
      color: 'bg-green-500',
      textColor: 'text-green-700',
    },
    calibration: {
      name: 'Filecoin Calibration',
      color: 'bg-purple-500',
      textColor: 'text-purple-700',
    },
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div
          className={`w-2 h-2 rounded-full ${networkConfig[network].color}`}
        />
        <span className="text-sm font-medium">
          {networkConfig[network].name}
        </span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div className="fixed inset-0 z-10" onClick={closeDropdown} />

          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu" aria-orientation="vertical">
              {Object.entries(networkConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleNetworkChange(key as Network)}
                  className={`
                    w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2
                    ${network === key ? 'bg-gray-50 font-medium' : ''}
                  `}
                  role="menuitem"
                >
                  <div className={`w-2 h-2 rounded-full ${config.color}`} />
                  <span>{config.name}</span>
                  {network === key && (
                    <svg
                      className="ml-auto h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
