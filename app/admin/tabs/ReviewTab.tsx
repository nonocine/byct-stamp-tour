'use client'
import { useCallback, useEffect, useState } from 'react'
import { Star, Users, BarChart3, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import type { AdminUser } from '@/components/AdminProvider'
import { formatDate, type ReviewRow, type ReviewSummary } from './shared'

interface Props {
  admin: AdminUser
}

export default function ReviewTab({ admin }: Props) {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewCenterId, setReviewCenterId] = useState<number | null>(
    admin.role === 'center' ? (admin.center_id ?? null) : null,
  )
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  const loadReviews = useCallback(async (centerId: number | null) => {
    setReviewsLoading(true)
    try {
      let query = supabase
        .from('reviews')
        .select('id, participant_id, participant_name, center_id, center_name, rating, comment, created_at')
        .order('created_at', { ascending: false })
      if (centerId !== null) query = query.eq('center_id', centerId)
      const { data } = await query
      setReviews((data ?? []) as ReviewRow[])
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  async function handleDeleteReview(id: string) {
    if (admin.role !== 'super') return
    if (!confirm('이 평가를 삭제할까요?')) return
    setDeletingReviewId(id)
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
      setReviews(prev => prev.filter(r => r.id !== id))
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '삭제에 실패했습니다. 다시 시도해주세요.'
      )
    } finally {
      setDeletingReviewId(null)
    }
  }

  useEffect(() => {
    loadReviews(reviewCenterId)
  }, [reviewCenterId, loadReviews])

  const visibleCenterId = admin.role === 'center' ? admin.center_id : reviewCenterId
  const filtered = visibleCenterId !== null && visibleCenterId !== undefined
    ? reviews.filter(r => r.center_id === visibleCenterId)
    : reviews

  const summaryMap: Record<number, { name: string; total: number; sum: number }> = {}
  reviews.forEach(r => {
    if (!summaryMap[r.center_id]) summaryMap[r.center_id] = { name: r.center_name, total: 0, sum: 0 }
    summaryMap[r.center_id].total += 1
    summaryMap[r.center_id].sum += r.rating
  })
  const summary: ReviewSummary[] = ORGANIZATIONS
    .filter(o => admin.role === 'super' || admin.center_id === o.id)
    .map(o => {
      const s = summaryMap[o.id]
      return {
        center_id: o.id,
        center_name: o.name,
        count: s?.total ?? 0,
        avg: s ? Math.round((s.sum / s.total) * 10) / 10 : 0,
      }
    })
    .sort((a, b) => b.avg - a.avg || b.count - a.count)

  const overallCount = filtered.length
  const overallAvg = overallCount > 0
    ? Math.round((filtered.reduce((acc, r) => acc + r.rating, 0) / overallCount) * 10) / 10
    : 0

  return (
    <div className="px-4 space-y-4">
      {admin.role === 'center' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에 작성된 평가만 조회됩니다.
          </p>
        </div>
      )}

      {admin.role === 'super' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 필터</label>
          <select
            value={reviewCenterId ?? ''}
            onChange={e => {
              const v = e.target.value
              setReviewCenterId(v === '' ? null : Number(v))
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="">전체 기관</option>
            {ORGANIZATIONS.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500 rounded-2xl p-4 text-white">
          <Star size={20} className="mb-2 opacity-90 fill-white" />
          <p className="text-3xl font-black">
            {overallAvg > 0 ? overallAvg.toFixed(1) : '-'}
          </p>
          <p className="text-sm text-amber-100 mt-0.5">평균 별점</p>
        </div>
        <div className="bg-rose-500 rounded-2xl p-4 text-white">
          <Users size={20} className="mb-2 opacity-90" />
          <p className="text-3xl font-black">{overallCount}</p>
          <p className="text-sm text-rose-100 mt-0.5">평가 수</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <BarChart3 size={15} /> 기관별 평균 별점
          </h2>
          <button onClick={() => loadReviews(reviewCenterId)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={13} className={reviewsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {summary.map(({ center_id, center_name, count, avg }, idx) => {
            const org = ORGANIZATIONS.find(o => o.id === center_id)
            return (
              <button
                key={center_id}
                type="button"
                onClick={() => admin.role === 'super' && setReviewCenterId(center_id)}
                disabled={admin.role !== 'super'}
                className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                  admin.role === 'super' ? 'hover:bg-gray-50' : ''
                } ${reviewCenterId === center_id ? 'bg-amber-50' : ''}`}
              >
                <span className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</span>
                {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{center_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          size={11}
                          strokeWidth={1.5}
                          className={n <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{count}건</span>
                  </div>
                </div>
                <p className="text-base font-black text-amber-500 flex-shrink-0">
                  {avg > 0 ? avg.toFixed(1) : '-'}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            💬 한줄평 목록
            {!reviewsLoading && (
              <span className="text-xs text-gray-400 font-normal">{filtered.length}건</span>
            )}
          </h2>
          {admin.role === 'super' && reviewCenterId !== null && (
            <button
              onClick={() => setReviewCenterId(null)}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700"
            >
              전체 보기
            </button>
          )}
        </div>

        {reviewsLoading ? (
          <div className="py-10 flex justify-center">
            <RefreshCw size={18} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">아직 작성된 평가가 없습니다</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(r => {
              const org = ORGANIZATIONS.find(o => o.id === r.center_id)
              return (
                <div key={r.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-2.5">
                    {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-700 truncate">{r.center_name}</p>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star
                              key={n}
                              size={11}
                              strokeWidth={1.5}
                              className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                            />
                          ))}
                          <span className="text-xs font-bold text-amber-600 ml-1">{r.rating}</span>
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-800 mt-1.5 leading-relaxed">"{r.comment}"</p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-xs text-gray-400">
                          {r.participant_name} · {formatDate(r.created_at)}
                        </p>
                        {admin.role === 'super' && (
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            disabled={deletingReviewId === r.id}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="평가 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
