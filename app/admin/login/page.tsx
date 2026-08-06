'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Lock, Shield, ChevronLeft } from 'lucide-react'
import { useAdmin } from '@/components/AdminProvider'
import type { AdminUser } from '@/components/AdminProvider'

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

export default function AdminLoginPage() {
  const router = useRouter()
  const { admin, loading, loginAdmin } = useAdmin()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && admin) router.replace('/admin')
  }, [admin, loading, router])

  async function handleLogin() {
    if (!phone || !password) { setError('전화번호와 비밀번호를 입력해주세요'); return }
    setBusy(true)
    setError('')
    try {
      // 비밀번호 검증은 서버에서만 수행한다. admins 테이블은 브라우저에서
      // 접근할 수 없다(RLS 차단). 성공 시 서버가 HttpOnly 세션 쿠키를 심는다.
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        setError(payload?.error ?? '로그인에 실패했습니다')
        return
      }

      loginAdmin(payload.admin as AdminUser)
      router.replace('/admin')
    } catch (e: any) {
      console.error('[AdminLogin] 오류:', e)
      setError('네트워크 오류로 로그인에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="px-4 py-5">
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-1 text-gray-500 text-sm mb-6"
      >
        <ChevronLeft size={16} /> 메인으로
      </button>

      <div className="mb-6">
        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mb-3">
          <Shield size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">관리자 로그인</h1>
        <p className="text-sm text-gray-500 mt-1">B.Y.C.T 스탬프투어 관리자 전용</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Phone size={13} className="inline mr-1" />
            전화번호
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => { setPhone(formatPhone(e.target.value)); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="010-1234-5678"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 tracking-wider"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Lock size={13} className="inline mr-1" />
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={busy}
          className="w-full py-4 bg-gray-900 text-white font-bold text-base rounded-2xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
        >
          {busy ? '확인 중...' : '관리자 로그인'}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        일반 참여자는{' '}
        <button onClick={() => router.push('/login')} className="text-blue-600 font-medium">
          여기
        </button>
        에서 로그인하세요
      </p>
    </div>
  )
}
