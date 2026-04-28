'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export type AdminRole = 'super' | 'center'

export interface AdminUser {
  id: string
  name: string
  phone: string
  role: AdminRole
  center_id: number | null
  center_name: string | null
}

interface AdminContextType {
  admin: AdminUser | null
  loading: boolean
  loginAdmin: (a: AdminUser) => void
  logoutAdmin: () => void
}

const ADMIN_KEY = 'byct_admin'

const AdminContext = createContext<AdminContextType>({
  admin: null,
  loading: true,
  loginAdmin: () => {},
  logoutAdmin: () => {},
})

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_KEY)
      if (raw) setAdmin(JSON.parse(raw))
    } catch {}
    setLoading(false)
  }, [])

  function loginAdmin(a: AdminUser) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(a))
    setAdmin(a)
  }

  function logoutAdmin() {
    localStorage.removeItem(ADMIN_KEY)
    setAdmin(null)
  }

  return (
    <AdminContext.Provider value={{ admin, loading, loginAdmin, logoutAdmin }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
