import { Landing } from '@/pages/Landing'
import { ProofSetDetails } from '@/pages/ProofSetDetails'
import { ProofSets } from '@/pages/ProofSets'
import { ProviderDetails } from '@/pages/ProviderDetails'
import { Providers } from '@/pages/Providers'
import { Route, Routes } from 'react-router-dom'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/providers" element={<Providers />} />
      <Route path="/providers/:providerId" element={<ProviderDetails />} />
      <Route path="/proofsets" element={<ProofSets />} />
      <Route path="/proofsets/:proofSetId" element={<ProofSetDetails />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}

export default AppRoutes
