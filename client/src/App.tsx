import { BrowserRouter as Router } from 'react-router-dom'
import AppRoutes from '@/router/routes'
import { CommandMenu } from '@/components/CommandMenu'
import { Toaster } from '@/components/ui/sonner'
import { Route } from 'react-router-dom'
import ProviderDetailsPage from './pages/ProviderDetailsPage'
import ProofSetDetailsPage from './pages/ProofSetDetailsPage'

function App() {
  return (
    <Router>
      <CommandMenu />
      <AppRoutes />
      <Toaster />
    </Router>
  )
}

export default App
