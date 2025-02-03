import { Footer } from '@/components/shared/Footer'
import { Header } from '../components/shared/Header'

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <Header />
      {children}
      <Footer />
    </div>
  )
}

export default Layout
