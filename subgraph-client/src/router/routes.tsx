import { Landing } from '@/pages/Landing'
import { ProofSetDetails } from '@/pages/ProofSetDetails'
import { ProofSets } from '@/pages/ProofSets'
import { ProviderDetails } from '@/pages/ProviderDetails'
import { Providers } from '@/pages/Providers'
import { Documentation } from '@/pages/Documentation'
import { GasCalculator } from '@/pages/GasCalculator'
import {
  Route,
  Routes,
  Navigate,
  useParams,
  useNavigate,
} from 'react-router-dom'
import { useNetwork } from '@/contexts/NetworkContext'
import { useEffect } from 'react'

// Redirect component with parameter capture
const CustomRedirect = ({
  slug,
  midPath,
}: {
  slug: string
  midPath: string
}) => {
  const params = useParams()
  const { network } = useNetwork()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`/${network}/${midPath}/${params[slug]}`, { replace: true })
  }, [network, params[slug], navigate])

  return null
}

const AppRoutes = () => {
  const { network } = useNetwork()

  return (
    <Routes>
      {/* Root route redirects to network-specific path */}
      <Route path="/" element={<Navigate to={`/${network}`} replace />} />

      {/* Network-specific routes */}
      <Route path="/:network" element={<Landing />} />
      <Route path="/:network/providers" element={<Providers />} />
      <Route
        path="/:network/providers/:providerId"
        element={<ProviderDetails />}
      />
      <Route path="/:network/proofsets" element={<ProofSets />} />
      <Route
        path="/:network/proofsets/:proofSetId"
        element={<ProofSetDetails />}
      />

      {/* Network-agnostic routes */}
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/documentation/:docId" element={<Documentation />} />
      <Route path="/gas-calculator" element={<GasCalculator />} />

      {/* Legacy routes for backward compatibility */}
      <Route
        path="/providers"
        element={<Navigate to={`/${network}/providers`} replace />}
      />
      <Route
        path="/providers/:providerId"
        element={<CustomRedirect slug="providerId" midPath="providers" />}
      />
      <Route
        path="/proofsets"
        element={<Navigate to={`/${network}/proofsets`} replace />}
      />
      <Route
        path="/proofsets/:proofSetId"
        element={<CustomRedirect slug="proofSetId" midPath="proofsets" />}
      />

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to={`/${network}`} replace />} />
    </Routes>
  )
}

export default AppRoutes
