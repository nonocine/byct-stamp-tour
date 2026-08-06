'use client'
import { useEffect, useState } from 'react'
import { Star, X, Save, Trash2, RefreshCw } from 'lucide-react'
import OrgIcon from '@/components/OrgIcon'
import type { Organization } from '@/lib/types'

interface ExistingReview {
  id: string
  rating: number
  comment: string | null
  program_rating: number | null
  leader_rating: number | null
  facility_rating: number | null
  wish_program: string | null
  created_at?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  org: Organization
  participant: { id: string; name: string }
  onSaved?: () => void
}

// 별점 입력 한 줄
function StarRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-gray-700">
        {label} <span className="text-red-500">*</span>
      </span>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="p-0.5 transition-transform active:scale-90"
          >
            <Star
              size={26}
              strokeWidth={1.5}
              className={n <= display ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewModal({ open, onClose, org, participant, onSaved }: Props) {
  const [programRating, setProgramRating] = useState(0)
  const [leaderRating, setLeaderRating] = useState(0)
  const [facilityRating, setFacilityRating] = useState(0)
  const [wishProgram, setWishProgram] = useState('')
  const [comment, setComment] = useState('')
  const [existing, setExisting] = useState<ExistingReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    loadReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, org.id, participant.id])

  async function loadReview() {
    setLoading(true)
    try {
      // 본인 평가만 반환된다 (서버가 세션 쿠키의 participant_id 로 필터).
      const res = await fetch(`/api/me/reviews?centerId=${org.id}`, { cache: 'no-store' })
      const payload = res.ok ? await res.json().catch(() => null) : null
      const data = payload?.review ?? null
      if (data) {
        setExisting(data)
        // 신규 항목이 있으면 그대로, 없으면(구버전 데이터) 기존 rating으로 채움
        setProgramRating(data.program_rating ?? data.rating ?? 0)
        setLeaderRating(data.leader_rating ?? data.rating ?? 0)
        setFacilityRating(data.facility_rating ?? data.rating ?? 0)
        setWishProgram(data.wish_program ?? '')
        setComment(data.comment ?? '')
      } else {
        setExisting(null)
        setProgramRating(0)
        setLeaderRating(0)
        setFacilityRating(0)
        setWishProgram('')
        setComment('')
      }
    } finally {
      setLoading(false)
    }
  }

  const allRated = programRating >= 1 && leaderRating >= 1 && facilityRating >= 1

  async function handleSave() {
    if (!allRated) {
      setError('프로그램·지도자·시설 만족도를 모두 선택해주세요 (1~5점)')
      return
    }
    setSaving(true)
    setError('')
    try {
      // participant_id / participant_name / rating 은 서버가 결정한다.
      // 클라이언트가 보낸 신원 정보를 신뢰하지 않기 위함.
      const res = await fetch('/api/me/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_id: org.id,
          program_rating: programRating,
          leader_rating: leaderRating,
          facility_rating: facilityRating,
          wish_program: wishProgram.trim() || null,
          comment: comment.trim() || null,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? '저장에 실패했습니다. 다시 시도해주세요.')
        return
      }
      onSaved?.()
      onClose()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    if (!confirm('작성한 평가를 삭제하시겠습니까?')) return
    setSaving(true)
    setError('')
    try {
      // id 대신 centerId 를 보낸다 — 서버가 세션의 participant_id 와 함께
      // 조건을 걸어 지우므로 남의 평가 id 를 넣어도 지워지지 않는다.
      const res = await fetch(`/api/me/reviews?centerId=${org.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? '삭제에 실패했습니다. 다시 시도해주세요.')
        return
      }
      onSaved?.()
      onClose()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => { if (!saving) onClose() }}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <OrgIcon org={org} size={32} rounded="rounded-lg" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{org.name}</p>
              <p className="text-xs text-gray-400">{existing ? '평가 수정' : '평가 작성'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <RefreshCw size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* 항목별 만족도 */}
            <div className="px-5 py-5 space-y-4">
              <p className="text-sm font-semibold text-gray-700 text-center mb-1">이 기관의 체험을 평가해주세요</p>
              <StarRow label="프로그램 만족도" value={programRating} onChange={setProgramRating} />
              <StarRow label="지도자 만족도" value={leaderRating} onChange={setLeaderRating} />
              <StarRow label="시설 만족도" value={facilityRating} onChange={setFacilityRating} />
            </div>

            {/* 희망 프로그램 */}
            <div className="px-5 pb-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">앞으로 생겼으면 하는 프로그램 (선택)</label>
              <input
                type="text"
                value={wishProgram}
                onChange={e => setWishProgram(e.target.value.slice(0, 200))}
                placeholder="예: 진로 체험, 코딩 캠프 등"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>

            {/* 한줄평 */}
            <div className="px-5 pb-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">한줄 평가 (선택)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="체험 경험을 짧게 적어주세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 resize-none"
              />
              <p className="text-right text-xs text-gray-400 mt-1">{comment.length}/200</p>
            </div>

            {error && (
              <div className="mx-5 mb-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 액션 */}
            <div className="px-5 pb-5 flex gap-2">
              {existing && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              )}
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !allRated}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? '저장 중...' : existing ? '수정' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
