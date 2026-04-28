'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, ChevronRight, LogIn, RefreshCw, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS, getOrgById } from '@/lib/data'
import StampGrid from '@/components/StampGrid'
import OrgIcon from '@/components/OrgIcon'
import { useAuth } from '@/components/AuthProvider'

interface StampRecord {
  id: string
  center_id: number
  center_name: string
  approved_by: string
  stamped_at: string
}

export default function StampsPage() {
  const { profile, loading } = useAuth()
  const [records, setRecords] = useState<StampRecord[]>([])
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchStamps()
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStamps() {
    if (!profile) return
    setFetching(true)
    const { data, error } = await supabase
      .from('stamp_records')
      .select('id, center_id, center_name, approved_by, stamped_at')
      .eq('participant_id', profile.id)
      .order('stamped_at', { ascending: false })
    console.log('participant.id:', profile.id)
    console.log('stamp data:', data)
    console.log('stamp error:', error)
    setRecords(data ?? [])
    setFetching(false)
  }

  if (loading) return null

  if (!profile) {
    return (
      <div className="px-4 py-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Award size={36} className="text-blue-300" />
        </div>
        <h2 className="text-lg font-bold text-gray-700 mb-1">로그인이 필요합니다</h2>
        <p className="text-sm text-gray-400 mb-5">로그인 후 스탬프를 모아보세요!</p>
        <Link
          href="/login"
          className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl hover:bg-blue-700 transition-colors"
        >
          <LogIn size={16} />
          로그인 / 회원가입
        </Link>
      </div>
    )
  }

  const stampedOrgIds = new Set(records.map(r => r.center_id))
  const count = stampedOrgIds.size
  const progress = Math.round((count / 17) * 100)
  const isComplete = count >= 17
  const displayPhone = profile.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')

  function formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">내 스탬프</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profile.name} · {displayPhone}</p>
        </div>
        <button
          onClick={fetchStamps}
          disabled={fetching}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 완주 배너 */}
      {isComplete && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-5 text-white text-center shadow-lg shadow-orange-200">
          <p className="text-3xl mb-1">🎉</p>
          <p className="text-lg font-black">완주 달성!</p>
          <p className="text-sm text-yellow-100 mt-1">17개 기관을 모두 체험하셨습니다!</p>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          스탬프는 기관 방문 후 담당자가 인증해 드립니다.
        </p>
      </div>

      {/* 진행 현황 카드 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">수집 현황</h2>
          <span className="text-sm text-gray-500">{count} / 17</span>
        </div>

        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: isComplete
                ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                : 'linear-gradient(90deg, #3B82F6, #6366F1)',
            }}
          />
          {count > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-overlay">
              {progress}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-100 text-center">
          <div>
            <p className="text-xl font-black text-blue-600">{count}</p>
            <p className="text-xs text-gray-400">수집 스탬프</p>
          </div>
          <div>
            <p className="text-xl font-black text-green-600">{17 - count}</p>
            <p className="text-xs text-gray-400">남은 기관</p>
          </div>
        </div>
      </div>

      {/* 스탬프 그리드 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-4">스탬프 현황</h2>
        {fetching && records.length === 0 ? (
          <div className="py-6 flex justify-center">
            <RefreshCw size={18} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <StampGrid organizations={ORGANIZATIONS} stampedOrgIds={stampedOrgIds} />
        )}
      </div>

      {/* 체험 기록 */}
      {records.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">체험 기록</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {records.map(record => {
              const org = getOrgById(record.center_id)
              if (!org) return null
              return (
                <div key={record.id} className="px-5 py-3.5 flex items-center gap-3">
                  <OrgIcon org={org} size={36} rounded="rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{org.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">담당: {record.approved_by}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1"
                      style={{ backgroundColor: org.color }}
                    >
                      ✓
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(record.stamped_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 남은 기관 안내 */}
      {count < 17 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">아직 {17 - count}개 기관이 남았어요!</p>
          <p className="text-xs text-blue-600 mb-3">더 많은 프로그램을 체험하고 스탬프를 모아보세요.</p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            프로그램 목록 보기 <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
