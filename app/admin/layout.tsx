import { AdminProvider } from '@/components/AdminProvider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>
}
