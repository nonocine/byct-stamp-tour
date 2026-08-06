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
/** 탭 세션당 한 번만 쿠키 재발급을 시도하기 위한 플래그. */
const SESSION_SYNCED_KEY = 'byct_session_synced'

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
    let stored: Profile | null = null
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (raw) {
        stored = JSON.parse(raw) as Profile
        setProfile(stored)
      }
    } catch {}
    setLoading(false)

    // 세션 쿠키 동기화.
    //
    // 이 앱에는 localStorage 로만 로그인 상태를 유지해 온 사용자가 이미 많다.
    // 평가 작성·알림 구독 API 는 이제 HttpOnly 세션 쿠키를 요구하므로,
    // 저장된 프로필이 있으면 그 자격증명(전화번호+생년월일)으로 쿠키를 한 번
    // 재발급받는다. 로그인과 동일한 검증을 서버가 다시 수행하므로 보안 수준은
    // 같다 — localStorage 를 신뢰해서 통과시키는 것이 아니다.
    //
    // HttpOnly 쿠키는 JS 로 존재 여부를 알 수 없어서 탭 세션당 1회로 제한한다.
    if (!stored?.phone || !stored?.birthdate) return
    try {
      if (sessionStorage.getItem(SESSION_SYNCED_KEY)) return
      sessionStorage.setItem(SESSION_SYNCED_KEY, '1')
    } catch {}

    fetch('/api/participant/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: stored.phone, birthdate: stored.birthdate }),
    }).catch(() => {})
  }, [])

  function login(p: Profile) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(p))
    setProfile(p)
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY)
    try { sessionStorage.removeItem(SESSION_SYNCED_KEY) } catch {}
    setProfile(null)
    // 서버 세션 쿠키도 함께 제거한다. localStorage 는 UI 표시용이고
    // 실제 본인 확인은 이 쿠키가 담당한다.
    fetch('/api/participant/logout', { method: 'POST' }).catch(() => {})
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
