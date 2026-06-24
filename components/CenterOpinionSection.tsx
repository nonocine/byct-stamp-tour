'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Save, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  centerId: number
  /** 담당지도자(기관 관리자)는 편집 가능, 슈퍼관리자는 읽기 전용 */
  canEdit: boolean
}

export default function CenterOpinionSection({ centerId, canEdit }: Props) {
  const [opinion, setOpinion] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setSavedAt(null)
      try {
        const { data } = await supabase
          .from('center_reports')
          .select('opinion')
          .eq('center_id', centerId)
          .maybeSingle()
        if (active) setOpinion(data?.opinion ?? '')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [centerId])

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('center_reports')
        .upsert(
          { center_id: centerId, opinion: opinion.trim() || null, updated_at: new Date().toISOString() },
          { onConflict: 'center_id' },
        )
      if (error) throw error
      setSavedAt(new Date().toLocaleTimeString('ko-KR'))
    } catch (e: any) {
      alert(`종합의견 저장 실패: ${e?.message ?? e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <MessageSquare size={15} /> 담당지도자 종합의견
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {canEdit
            ? '기관 운영에 대한 종합의견을 작성하고 저장하세요. 보고서에 함께 반영됩니다.'
            : '담당지도자가 작성한 종합의견입니다.'}
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <div className="py-6 flex justify-center">
            <RefreshCw size={16} className="animate-spin text-gray-300" />
          </div>
        ) : canEdit ? (
          <>
            <textarea
              value={opinion}
              onChange={e => { setOpinion(e.target.value); setSavedAt(null) }}
              rows={5}
              placeholder="기관 운영 종합의견을 입력해주세요."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex items-center justify-between">
              {savedAt ? (
                <span className="text-xs text-green-600">✓ 저장되었습니다 ({savedAt})</span>
              ) : <span />}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </button>
            </div>
          </>
        ) : opinion.trim() ? (
          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
            {opinion}
          </p>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">작성된 종합의견이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
