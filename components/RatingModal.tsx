'use client'
import { useState } from 'react'
import { X, Star } from 'lucide-react'
import type { Program, Organization } from '@/lib/types'
import OrgIcon from '@/components/OrgIcon'

interface Props {
  program: Program
  organization: Organization
  onClose: () => void
  onSubmit: (rating: number, review: string) => void
}

export default function RatingModal({ program, organization, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const ratingLabels = ['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요!']

  async function handleSubmit() {
    if (rating === 0) return
    setSubmitting(true)
    await onSubmit(rating, review)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div
          className="px-6 pt-6 pb-4 text-white"
          style={{ background: `linear-gradient(135deg, ${organization.color}, ${organization.color}99)` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">{organization.name}</p>
              <h2 className="text-lg font-bold mt-0.5">{program.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* 스탬프 획득 안내 */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <OrgIcon org={organization} size={32} rounded="rounded-full" />
            <p className="text-sm text-amber-800">
              체험 후 별점을 남기면 <strong>스탬프</strong>가 적립됩니다!
            </p>
          </div>

          {/* 별점 */}
          <div className="text-center mb-5">
            <p className="text-sm font-medium text-gray-600 mb-3">체험은 어떠셨나요?</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    size={36}
                    className="transition-colors"
                    fill={(hovered || rating) >= n ? '#F59E0B' : 'none'}
                    stroke={(hovered || rating) >= n ? '#F59E0B' : '#D1D5DB'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            {(hovered || rating) > 0 && (
              <p className="text-sm font-semibold text-amber-600">
                {ratingLabels[hovered || rating]}
              </p>
            )}
          </div>

          {/* 한 줄 소감 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한 줄 소감 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={review}
              onChange={e => setReview(e.target.value)}
              placeholder="체험 소감을 짧게 적어주세요..."
              rows={2}
              maxLength={100}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: rating > 0 ? organization.color : '#9CA3AF' }}
          >
            {submitting ? '저장 중...' : '스탬프 받기 🎉'}
          </button>
        </div>
      </div>
    </div>
  )
}
