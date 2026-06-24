'use client'
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Save, MessageSquare, ImagePlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  centerId: number
  /** 담당지도자(기관 관리자)는 편집 가능, 슈퍼관리자는 읽기 전용 */
  canEdit: boolean
}

const MAX_PHOTOS = 5
const BUCKET = 'report-photos'

export default function CenterOpinionSection({ centerId, canEdit }: Props) {
  const [opinion, setOpinion] = useState('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setSavedAt(null)
      try {
        const { data } = await supabase
          .from('center_reports')
          .select('opinion, photo_urls')
          .eq('center_id', centerId)
          .maybeSingle()
        if (active) {
          setOpinion(data?.opinion ?? '')
          setPhotoUrls((data?.photo_urls as string[] | null) ?? [])
        }
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

  // photo_urls 배열만 따로 upsert (opinion은 건드리지 않음)
  async function persistPhotos(next: string[]) {
    const { error } = await supabase
      .from('center_reports')
      .upsert(
        { center_id: centerId, photo_urls: next, updated_at: new Date().toISOString() },
        { onConflict: 'center_id' },
      )
    if (error) throw error
  }

  function triggerUpload() {
    if (photoUrls.length >= MAX_PHOTOS) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다.`)
      return
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const room = MAX_PHOTOS - photoUrls.length
    if (room <= 0) {
      alert(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다.`)
      return
    }
    const targets = files.slice(0, room)

    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of targets) {
        if (!file.type.startsWith('image/')) {
          alert(`이미지 파일만 업로드할 수 있습니다: ${file.name}`)
          continue
        }
        const MAX_SIZE = 10 * 1024 * 1024
        if (file.size > MAX_SIZE) {
          alert(`파일이 너무 큽니다 (10MB 이하): ${file.name}`)
          continue
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${centerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
        uploaded.push(pub.publicUrl)
      }
      if (uploaded.length > 0) {
        const next = [...photoUrls, ...uploaded]
        await persistPhotos(next)
        setPhotoUrls(next)
      }
    } catch (e: any) {
      alert(`사진 업로드 실패: ${e?.message ?? e}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return
    try {
      const marker = `/${BUCKET}/`
      const idx = url.indexOf(marker)
      if (idx >= 0) {
        const p = url.slice(idx + marker.length)
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([p])
        if (rmErr) console.warn('[사진] Storage 제거 실패:', rmErr.message)
      }
      const next = photoUrls.filter(u => u !== url)
      await persistPhotos(next)
      setPhotoUrls(next)
    } catch (e: any) {
      alert(`사진 삭제 실패: ${e?.message ?? e}`)
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

      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <div className="py-6 flex justify-center">
            <RefreshCw size={16} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* 종합의견 */}
            {canEdit ? (
              <div className="space-y-3">
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
              </div>
            ) : opinion.trim() ? (
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
                {opinion}
              </p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">작성된 종합의견이 없습니다.</p>
            )}

            {/* 현장 사진 */}
            {(canEdit || photoUrls.length > 0) && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">
                    현장 사진 <span className="text-gray-400 font-normal">({photoUrls.length}/{MAX_PHOTOS})</span>
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photoUrls.map(url => (
                    <div key={url} className="relative group aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="현장 사진"
                        className="w-full h-full object-cover rounded-xl border border-gray-200"
                      />
                      {canEdit && (
                        <button
                          onClick={() => handleDeletePhoto(url)}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 active:scale-90 transition-all"
                          title="삭제"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}

                  {canEdit && photoUrls.length < MAX_PHOTOS && (
                    <button
                      onClick={triggerUpload}
                      disabled={uploading}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <>
                          <ImagePlus size={20} />
                          <span className="text-[10px] font-medium">사진 추가</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
