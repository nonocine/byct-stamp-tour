'use client'
import { useEffect, useState } from 'react'
import { Star, X, Save, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import OrgIcon from '@/components/OrgIcon'
import type { Organization } from '@/lib/types'

interface ExistingReview {
  id: string
  rating: number
  comment: string | null
  created_at?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  org: Organization
  participant: { id: string; name: string }
  onSaved?: () => void
}

export default function ReviewModal({ open, onClose, org, participant, onSaved }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [existing, setExisting] = useState<ExistingReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setHover(0)
    loadReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, org.id, participant.id])

  async function loadReview() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('participant_id', participant.id)
        .eq('center_id', org.id)
        .maybeSingle()
      if (data) {
        setExisting(data)
        setRating(data.rating)
        setComment(data.comment ?? '')
      } else {
        setExisting(null)
        setRating(0)
        setComment('')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (rating < 1 || rating > 5) {
      setError('별점을 선택해주세요 (1~5점)')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        participant_id: participant.id,
        participant_name: participant.name,
        center_id: org.id,
        center_name: org.name,
        rating,
        comment: comment.trim() || null,
      }
      const { error: upsertErr } = await supabase
        .from('reviews')
        .upsert(payload, { onConflict: 'participant_id,center_id' })
      if (upsertErr) throw upsertErr
      onSaved?.()
      onClose()
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      if (msg.includes('failed to fetch') || msg.includes('network')) {
        setError('네트워크 오류가 발생했습니다.')
      } else {
        setError('저장에 실패했습니다. 다시 시도해주세요.')
      }
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
      const { error: delErr } = await supabase.from('reviews').delete().eq('id', existing.id)
      if (delErr) throw delErr
      onSaved?.()
      onClose()
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      if (msg.includes('failed to fetch') || msg.includes('network')) {
        setError('네트워크 오류가 발생했습니다.')
      } else {
        setError('삭제에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const display = hover || rating

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
            {/* 별점 */}
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-3 text-center">이 기관의 체험을 평가해주세요</p>
              <div className="flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map(n => {
                  const filled = n <= display
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      className="p-1 transition-transform active:scale-90"
                    >
                      <Star
                        size={36}
                        strokeWidth={1.5}
                        className={filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                      />
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-center text-gray-500 mt-2 h-4">
                {display > 0 ? `${display}점 / 5점` : ' '}
              </p>
            </div>

            {/* 한줄평 */}
            <div className="px-5 pb-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">한줄 평가</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="체험 경험을 짧게 적어주세요 (선택)"
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
                disabled={saving || rating < 1}
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
