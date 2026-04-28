'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export interface Profile {
  id: string
  name: string
  phone: string
  birthdate: string
  created_at: string
}

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  login: (profile: Profile) => void
  signOut: () => void
}

const AUTH_KEY = 'byct_auth_profile'

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  login: () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      // 옛 데모 모드 키 정리 — 스탬프는 stamp_records 테이블이 단일 진실
      localStorage.removeItem('byct_stamps')
      localStorage.removeItem('byct_participant')
    } catch {}
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (raw) setProfile(JSON.parse(raw))
    } catch {}
    setLoading(false)
  }, [])

  function login(p: Profile) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(p))
    setProfile(p)
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
