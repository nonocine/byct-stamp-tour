'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Award, ChevronRight, LogIn, RefreshCw, Info, Star, FileDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS, getOrgById } from '@/lib/data'
import StampGrid from '@/components/StampGrid'
import OrgIcon from '@/components/OrgIcon'
import ReviewModal from '@/components/ReviewModal'
import Certificate from '@/components/Certificate'
import { useAuth } from '@/components/AuthProvider'
import { downloadCertificatePdf } from '@/lib/generateCertificate'
import type { Organization } from '@/lib/types'

interface StampRecord {
  id: string
  center_id: number
  center_name: string
  approved_by: string
  stamped_at: string
}

interface ReviewRecord {
  id: string
  center_id: number
  rating: number
  comment: string | null
}

export default function StampsPage() {
  const { profile, loading } = useAuth()
  const [records, setRecords] = useState<StampRecord[]>([])
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [approvedOrgIds, setApprovedOrgIds] = useState<Set<number>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [reviewOrg, setReviewOrg] = useState<Organization | null>(null)
  const [generating, setGenerating] = useState(false)
  const certificateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profile) return
    fetchAll()
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    if (!profile) return
    setFetching(true)
    const [stampsRes, reviewsRes, appsRes] = await Promise.all([
      supabase
        .from('stamp_records')
        .select('id, center_id, center_name, approved_by, stamped_at')
        .eq('participant_id', profile.id)
        .order('stamped_at', { ascending: false }),
      // reviews 는 RLS로 잠겨 있어 서버 경유. 본인 것만 반환된다.
      fetch('/api/me/reviews', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      supabase
        .from('applications')
        .select('center_id')
        .eq('participant_id', profile.id)
        .eq('status', 'approved'),
    ])
    setRecords(stampsRes.data ?? [])
    setReviews(reviewsRes?.reviews ?? [])
    setApprovedOrgIds(new Set((appsRes.data ?? []).map((a: any) => a.center_id)))
    setFetching(false)
  }

  function handleSelectOrg(org: Organization, collected: boolean) {
    // 스탬프가 없어도 승인된 신청이 있으면 평가 작성 가능
    if (!collected && !approvedOrgIds.has(org.id)) return
    setReviewOrg(org)
  }

  async function handleDownloadCertificate() {
    if (!profile || !certificateRef.current) return
    setGenerating(true)
    try {
      // 이미지가 캔버스에 그려지기 전 로드 완료를 보장
      const imgs = certificateRef.current.querySelectorAll('img')
      await Promise.all(
        Array.from(imgs).map(img =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                img.addEventListener('load', () => resolve(), { once: true })
                img.addEventListener('error', () => resolve(), { once: true })
              }),
        ),
      )
      await downloadCertificatePdf(certificateRef.current, profile.name)
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '인증서 생성에 실패했습니다. 다시 시도해주세요.',
      )
    } finally {
      setGenerating(false)
    }
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
  const reviewedOrgIds = new Set(reviews.map(r => r.center_id))
  const reviewByOrg = new Map(reviews.map(r => [r.center_id, r]))
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
          onClick={fetchAll}
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
          스탬프가 찍힌 기관을 누르면 별점·한줄평을 남길 수 있어요.
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

      {/* 인증서 발급 */}
      {count >= 3 && (
        <button
          onClick={handleDownloadCertificate}
          disabled={generating}
          className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-bold text-sm shadow-sm border transition-all active:scale-[0.98] disabled:opacity-60 ${
            isComplete
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-orange-300 hover:from-amber-500 hover:to-orange-600'
              : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
          }`}
        >
          {generating ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> 인증서 생성 중...
            </>
          ) : (
            <>
              <FileDown size={16} />
              {isComplete ? '완주 수료증 발급' : '수료증 발급'}
            </>
          )}
        </button>
      )}

      {/* 스탬프 그리드 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700">스탬프 현황</h2>
          <p className="text-xs text-gray-400">탭하여 평가</p>
        </div>
        {fetching && records.length === 0 ? (
          <div className="py-6 flex justify-center">
            <RefreshCw size={18} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <StampGrid
            organizations={ORGANIZATIONS}
            stampedOrgIds={stampedOrgIds}
            reviewedOrgIds={reviewedOrgIds}
            reviewableOrgIds={approvedOrgIds}
            onSelect={handleSelectOrg}
          />
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
              const review = reviewByOrg.get(record.center_id)
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setReviewOrg(org)}
                  className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <OrgIcon org={org} size={36} rounded="rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{org.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">담당: {record.approved_by}</p>
                    {review ? (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star
                              key={n}
                              size={11}
                              strokeWidth={1.5}
                              className={n <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                            />
                          ))}
                          <span className="text-xs font-bold text-amber-600 ml-1">{review.rating}.0</span>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-gray-600 leading-snug line-clamp-2">"{review.comment}"</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs font-semibold text-blue-600">⭐ 평가 남기기</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1 ml-auto"
                      style={{ backgroundColor: org.color }}
                    >
                      ✓
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(record.stamped_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 평가 모달 */}
      {reviewOrg && (
        <ReviewModal
          open={!!reviewOrg}
          org={reviewOrg}
          participant={{ id: profile.id, name: profile.name }}
          onClose={() => setReviewOrg(null)}
          onSaved={fetchAll}
        />
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

      {/* 인증서 (오프스크린 — html2canvas 캡처용) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-10000px',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <Certificate
          ref={certificateRef}
          participantName={profile.name}
          stamps={records.map(r => ({
            center_id: r.center_id,
            center_name: r.center_name,
            stamped_at: r.stamped_at,
          }))}
          isComplete={isComplete}
          issueDate={new Date()}
        />
      </div>
    </div>
  )
}
