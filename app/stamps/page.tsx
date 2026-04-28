'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, Award, ChevronRight, LogIn } from 'lucide-react'
import { loadStamps } from '@/lib/store'
import { ORGANIZATIONS, getOrgById } from '@/lib/data'
import StampGrid from '@/components/StampGrid'
import OrgIcon from '@/components/OrgIcon'
import type { Stamp } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'

export default function StampsPage() {
  const { profile, loading } = useAuth()
  const [stamps, setStamps] = useState<Stamp[]>([])

  useEffect(() => {
    setStamps(loadStamps())
  }, [])

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

  const count = stamps.length
  const progress = Math.round((count / 17) * 100)
  const avgRating = stamps.length > 0
    ? (stamps.reduce((sum, s) => sum + s.rating, 0) / stamps.length).toFixed(1)
    : '—'
  const isComplete = count >= 17

  const displayPhone = profile.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-black text-gray-900">내 스탬프</h1>
        <p className="text-sm text-gray-500 mt-0.5">{profile.name} · {displayPhone}</p>
      </div>

      {/* 완주 배너 */}
      {isComplete && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-5 text-white text-center shadow-lg shadow-orange-200">
          <p className="text-3xl mb-1">🎉</p>
          <p className="text-lg font-black">완주 달성!</p>
          <p className="text-sm text-yellow-100 mt-1">17개 기관을 모두 체험하셨습니다!</p>
        </div>
      )}

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

        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div>
            <p className="text-xl font-black text-blue-600">{count}</p>
            <p className="text-xs text-gray-400">수집 스탬프</p>
          </div>
          <div>
            <p className="text-xl font-black text-amber-500">{avgRating}</p>
            <p className="text-xs text-gray-400">평균 별점</p>
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
        <StampGrid organizations={ORGANIZATIONS} stamps={stamps} />
      </div>

      {/* 체험 기록 */}
      {stamps.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">체험 기록</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[...stamps]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(stamp => {
                const org = getOrgById(stamp.organization_id)
                if (!org) return null
                const date = new Date(stamp.created_at)
                return (
                  <div key={stamp.id} className="px-5 py-3.5 flex items-center gap-3">
                    <OrgIcon org={org} size={36} rounded="rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{stamp.program_name}</p>
                      <p className="text-xs text-gray-400">{org.name}</p>
                      {stamp.review && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{stamp.review}"</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={10}
                            fill={i < stamp.rating ? '#F59E0B' : 'none'}
                            stroke={i < stamp.rating ? '#F59E0B' : '#D1D5DB'}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">
                        {date.getMonth() + 1}/{date.getDate()}
                      </p>
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
