'use client'
import { useState, useEffect } from 'react'
import { Lock, BarChart3, Users, Stamp, Star, TrendingUp, RefreshCw } from 'lucide-react'
import { ORGANIZATIONS, PROGRAMS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import type { Participant, Stamp as StampType } from '@/lib/types'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'byct2026'

// localStorage 기반 전체 통계 집계 (실제 서비스에서는 Supabase 사용)
function getAllData(): { participants: Participant[]; stamps: StampType[] } {
  if (typeof window === 'undefined') return { participants: [], stamps: [] }
  try {
    const p = localStorage.getItem('byct_participant')
    const s = localStorage.getItem('byct_stamps')
    const participants: Participant[] = p ? [JSON.parse(p)] : []
    const stamps: StampType[] = s ? JSON.parse(s) : []
    return { participants, stamps }
  } catch {
    return { participants: [], stamps: [] }
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [data, setData] = useState<{ participants: Participant[]; stamps: StampType[] }>({ participants: [], stamps: [] })

  useEffect(() => {
    if (authed) setData(getAllData())
  }, [authed])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setError('')
    } else {
      setError('비밀번호가 올바르지 않습니다')
    }
  }

  if (!authed) {
    return (
      <div className="px-4 py-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-3">
              <Lock size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900">관리자 페이지</h1>
            <p className="text-sm text-gray-500 mt-1">비밀번호를 입력해주세요</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-center tracking-widest"
            />
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              로그인
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-3">기본 비밀번호: byct2026</p>
        </div>
      </div>
    )
  }

  const { participants, stamps } = data
  const totalParticipants = participants.length
  const totalStamps = stamps.length
  const avgRating = stamps.length > 0
    ? (stamps.reduce((sum, s) => sum + s.rating, 0) / stamps.length).toFixed(1)
    : '—'
  const completedCount = participants.filter(p => {
    const pStamps = stamps.filter(s => s.participant_id === p.id)
    return new Set(pStamps.map(s => s.organization_id)).size >= 17
  }).length

  // 기관별 스탬프 수
  const orgStampCounts = ORGANIZATIONS.map(org => ({
    org,
    count: stamps.filter(s => s.organization_id === org.id).length,
    avgRating: (() => {
      const orgStamps = stamps.filter(s => s.organization_id === org.id)
      return orgStamps.length > 0
        ? (orgStamps.reduce((sum, s) => sum + s.rating, 0) / orgStamps.length).toFixed(1)
        : '—'
    })(),
  })).sort((a, b) => b.count - a.count)

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">관리자 통계</h1>
          <p className="text-sm text-gray-500 mt-0.5">B.Y.C.T 스탬프투어 현황</p>
        </div>
        <button
          onClick={() => setData(getAllData())}
          className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {/* 주요 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-600 rounded-2xl p-4 text-white">
          <Users size={20} className="mb-2 opacity-80" />
          <p className="text-3xl font-black">{totalParticipants}</p>
          <p className="text-sm text-blue-200 mt-0.5">총 참가자</p>
        </div>
        <div className="bg-indigo-600 rounded-2xl p-4 text-white">
          <Stamp size={20} className="mb-2 opacity-80" />
          <p className="text-3xl font-black">{totalStamps}</p>
          <p className="text-sm text-indigo-200 mt-0.5">총 스탬프 적립</p>
        </div>
        <div className="bg-amber-500 rounded-2xl p-4 text-white">
          <Star size={20} className="mb-2 opacity-80" />
          <p className="text-3xl font-black">{avgRating}</p>
          <p className="text-sm text-yellow-100 mt-0.5">평균 만족도</p>
        </div>
        <div className="bg-green-600 rounded-2xl p-4 text-white">
          <TrendingUp size={20} className="mb-2 opacity-80" />
          <p className="text-3xl font-black">{completedCount}</p>
          <p className="text-sm text-green-200 mt-0.5">완주자</p>
        </div>
      </div>

      {/* 참가자 유형 분석 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Users size={15} /> 참가자 유형
        </h2>
        {participants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">등록된 참가자가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {[
              { type: 'general', label: '일반체험단', color: '#3B82F6' },
              { type: 'youth', label: '청소년체험단', color: '#8B5CF6' },
            ].map(({ type, label, color }) => {
              const cnt = participants.filter(p => p.type === type).length
              const pct = totalParticipants > 0 ? Math.round((cnt / totalParticipants) * 100) : 0
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{cnt}명 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 기관별 참여 현황 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <BarChart3 size={15} /> 기관별 스탬프 현황
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {orgStampCounts.map(({ org, count, avgRating }, idx) => (
            <div key={org.id} className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</span>
              <OrgIcon org={org} size={32} rounded="rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{org.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${totalStamps > 0 ? Math.round((count / Math.max(...orgStampCounts.map(o => o.count), 1)) * 100) : 0}%`,
                      backgroundColor: org.color,
                      minWidth: count > 0 ? '8px' : '0',
                    }}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">{count}명</p>
                <div className="flex items-center gap-0.5 justify-end">
                  <Star size={9} fill="#F59E0B" stroke="#F59E0B" />
                  <p className="text-xs text-gray-500">{avgRating}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 참가자 목록 */}
      {participants.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users size={15} /> 참가자 목록
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {participants.map(p => {
              const pStamps = stamps.filter(s => s.participant_id === p.id)
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        p.type === 'youth' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {p.type === 'youth' ? '청소년단' : '일반'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{p.school} {p.grade && `· ${p.grade}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{pStamps.length}<span className="text-xs text-gray-400 font-normal">/17</span></p>
                    <p className="text-xs text-gray-400">{p.contact}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => { setAuthed(false); setPassword('') }}
        className="w-full py-3 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
      >
        로그아웃
      </button>
    </div>
  )
}
