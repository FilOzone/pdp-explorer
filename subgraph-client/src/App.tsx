import { BrowserRouter as Router } from 'react-router-dom'
import AppRoutes from '@/router/routes'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <Router>
      <AppRoutes />
      <Toaster />
    </Router>
  )
}

export default App
