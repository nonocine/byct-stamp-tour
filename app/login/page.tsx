'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, User, Calendar, ChevronLeft, LogIn, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import type { Profile } from '@/components/AuthProvider'
import { calculateKoreanAge, minBirthdateForMaxAge } from '@/lib/age'

const ADULT_AGE_LIMIT = 19
const AGE_RESTRICTION_MESSAGE =
  '본 서비스는 청소년 대상 프로그램으로, 만 19세 이상은 가입이 제한됩니다.'

type Mode = 'login' | 'signup'

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function formatBirthdate(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 4) return d
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
}

function rawDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function validateBirthdate(value: string): boolean {
  const d = rawDigits(value)
  if (d.length !== 8) return false
  const year = parseInt(d.slice(0, 4))
  const month = parseInt(d.slice(4, 6))
  const day = parseInt(d.slice(6, 8))
  return year >= 1900 && year <= 2020 && month >= 1 && month <= 12 && day >= 1 && day <= 31
}

export default function LoginPage() {
  const router = useRouter()
  const { profile, loading, login } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const minBirthdate = useMemo(() => minBirthdateForMaxAge(ADULT_AGE_LIMIT), [])

  useEffect(() => {
    if (!loading && profile) router.replace('/')
  }, [profile, loading, router])

  function switchMode(m: Mode) {
    setMode(m)
    setName('')
    setPhone('')
    setBirthdate('')
    setErrors({})
  }

  function validateLogin(): Record<string, string> {
    const e: Record<string, string> = {}
    if (rawDigits(phone).length < 10) e.phone = '올바른 전화번호를 입력해주세요'
    if (!validateBirthdate(birthdate)) e.birthdate = '올바른 생년월일을 입력해주세요 (예: 20100315)'
    return e
  }

  function validateSignup(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = '이름을 입력해주세요'
    if (rawDigits(phone).length < 10) e.phone = '올바른 전화번호를 입력해주세요'
    if (!validateBirthdate(birthdate)) {
      e.birthdate = '올바른 생년월일을 입력해주세요 (예: 20100315)'
    } else if (calculateKoreanAge(birthdate) >= ADULT_AGE_LIMIT) {
      e.form = AGE_RESTRICTION_MESSAGE
    }
    return e
  }

  async function handleLogin() {
    const e = validateLogin()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setBusy(true)
    setErrors({})
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', rawDigits(phone))
        .eq('birthdate', rawDigits(birthdate))
        .maybeSingle()

      if (error) throw error
      if (!data) {
        setErrors({ form: '전화번호 또는 생년월일이 일치하지 않습니다' })
        return
      }

      login(data as Profile)
      router.replace('/')
    } catch (err: any) {
      setErrors({ form: err.message ?? '로그인에 실패했습니다' })
    } finally {
      setBusy(false)
    }
  }

  async function handleSignup() {
    const e = validateSignup()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setBusy(true)
    setErrors({})
    try {
      // 중복 전화번호 확인
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', rawDigits(phone))
        .maybeSingle()

      if (existing) {
        setErrors({ phone: '이미 등록된 전화번호입니다. 로그인해주세요.' })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          name: name.trim(),
          phone: rawDigits(phone),
          birthdate: rawDigits(birthdate),
        })
        .select()
        .single()

      if (error) throw error

      login(data as Profile)
      router.replace('/')
    } catch (err: any) {
      setErrors({ form: err.message ?? '가입에 실패했습니다' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="px-4 py-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-gray-500 text-sm mb-5"
      >
        <ChevronLeft size={16} /> 뒤로가기
      </button>

      {/* 헤더 */}
      <div className="mb-6">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-3">
          <span className="text-white font-black text-lg">BY</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">B.Y.C.T 스탬프투어</h1>
        <p className="text-sm text-gray-500 mt-1">부산 17개 기관 스탬프를 모아보세요!</p>
      </div>

      {/* 탭 */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => switchMode('login')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'login'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LogIn size={14} className="inline mr-1.5" />
          로그인
        </button>
        <button
          onClick={() => switchMode('signup')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'signup'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserPlus size={14} className="inline mr-1.5" />
          회원가입
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        {/* 이름 (회원가입만) */}
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <User size={13} className="inline mr-1" />
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: '' })) }}
              placeholder="홍길동"
              className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
        )}

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Phone size={13} className="inline mr-1" />
            전화번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => { setPhone(formatPhone(e.target.value)); setErrors(v => ({ ...v, phone: '' })) }}
            placeholder="010-1234-5678"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-wider transition-all ${
              errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        {/* 생년월일 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Calendar size={13} className="inline mr-1" />
            생년월일 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={birthdate}
            onChange={e => {
              setBirthdate(formatBirthdate(e.target.value))
              setErrors(v => ({ ...v, birthdate: '', form: '' }))
            }}
            placeholder="2010-03-15"
            min={mode === 'signup' ? minBirthdate : undefined}
            className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-wider transition-all ${
              errors.birthdate ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}
          />
          {errors.birthdate && <p className="text-xs text-red-500 mt-1">{errors.birthdate}</p>}
          <p className="text-xs text-gray-400 mt-1">숫자 8자리로 입력해주세요 (예: 20100315)</p>
        </div>

        {/* 폼 에러 */}
        {errors.form && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {errors.form}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={mode === 'login' ? handleLogin : handleSignup}
          disabled={busy}
          className="w-full py-4 bg-blue-600 text-white font-bold text-base rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy
            ? (mode === 'login' ? '확인 중...' : '가입 중...')
            : (mode === 'login' ? '로그인' : '가입하기')}
        </button>

        {/* 모드 전환 안내 */}
        <p className="text-center text-xs text-gray-400">
          {mode === 'login' ? (
            <>처음 방문하셨나요?{' '}
              <button onClick={() => switchMode('signup')} className="text-blue-600 font-semibold">
                회원가입
              </button>
            </>
          ) : (
            <>이미 계정이 있으신가요?{' '}
              <button onClick={() => switchMode('login')} className="text-blue-600 font-semibold">
                로그인
              </button>
            </>
          )}
        </p>
      </div>

      {/* 개인정보 안내 */}
      <p className="text-center text-xs text-gray-400 mt-4 px-2 leading-relaxed">
        수집된 개인정보는 B.Y.C.T 스탬프투어 운영 목적으로만 사용되며,
        행사 종료 후 6개월 이내 파기됩니다.
      </p>
    </div>
  )
}
