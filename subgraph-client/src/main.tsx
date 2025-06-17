import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './router/routes'
import './styles/index.css'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { SWRConfig } from 'swr'
import { fetcher } from '@/utility/fetcher'
import { NetworkProvider } from '@/contexts/NetworkContext'
import { Toaster } from '@/components/ui/toaster'
import { ProgressBar } from '@/components/shared/ProgressBar'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        errorRetryCount: 2,
        errorRetryInterval: 5000,
        onError: (err) => console.error('GraphQL SWR error:', err),
      }}
    >
      <ThemeProvider>
        <BrowserRouter>
          <NetworkProvider>
            <ProgressBar />
            <AppRoutes />
            <Toaster />
          </NetworkProvider>
        </BrowserRouter>
      </ThemeProvider>
    </SWRConfig>
  </React.StrictMode>
)
