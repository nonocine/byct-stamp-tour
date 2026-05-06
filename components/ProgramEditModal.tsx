'use client'
import { useState } from 'react'
import { X, Save, ImagePlus, RefreshCw, CheckCircle } from 'lucide-react'
import { updateProgram, uploadProgramImage } from '@/lib/programs'
import type { Program } from '@/lib/types'

interface Props {
  program: Program
  ownerOrgId: number
  onClose: () => void
  onSaved: (updated: Program) => void
}

export default function ProgramEditModal({ program, ownerOrgId, onClose, onSaved }: Props) {
  const [name, setName] = useState(program.name)
  const [description, setDescription] = useState(program.description ?? '')
  const [date, setDate] = useState(program.date ?? '')
  const [time, setTime] = useState(program.time ?? '')
  const [capacity, setCapacity] = useState(String(program.capacity ?? 0))
  const [target, setTarget] = useState(program.target ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(program.image_url ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(program.image_url ?? null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('20MB 이하 이미지를 업로드해주세요.')
      return
    }
    setError('')
    setPendingFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function clearImage() {
    setPendingFile(null)
    setPreviewUrl(null)
    setImageUrl(null)
  }

  async function handleSave() {
    setError('')
    if (!name.trim()) { setError('프로그램 제목을 입력해주세요.'); return }
    const cap = Number(capacity)
    if (!Number.isFinite(cap) || cap < 0) { setError('정원은 0 이상의 숫자여야 합니다.'); return }

    setSaving(true)
    try {
      let nextImageUrl: string | null = imageUrl
      if (pendingFile) {
        nextImageUrl = await uploadProgramImage(program.id, ownerOrgId, pendingFile)
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        date: date.trim(),
        time: time.trim(),
        capacity: cap,
        target: target.trim(),
        image_url: nextImageUrl,
      }
      await updateProgram(program.id, ownerOrgId, payload)

      const updated: Program = { ...program, ...payload }
      setToast(true)
      setTimeout(() => {
        onSaved(updated)
        onClose()
      }, 900)
    } catch (e: any) {
      console.error('[ProgramEditModal] save error:', e)
      setError(e?.message ?? '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => { if (!saving) onClose() }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold text-gray-900">프로그램 수정</h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">대표 사진</label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="w-full aspect-video object-cover rounded-xl border border-gray-200"
                />
                <button
                  onClick={clearImage}
                  type="button"
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                  aria-label="사진 제거"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <ImagePlus size={28} className="text-gray-400 mb-1.5" />
                <p className="text-xs text-gray-500">사진 선택 (자동 압축)</p>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
            {previewUrl && (
              <label className="mt-2 inline-block">
                <span className="text-xs text-blue-600 cursor-pointer hover:underline">사진 변경</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로그램 제목</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로그램 설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">날짜</label>
              <input
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="2026-08-08"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">시간</label>
              <input
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="10:00 ~ 12:00"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">정원</label>
              <input
                type="number"
                min="0"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">대상</label>
              <input
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="청소년 / 초등 3~6학년 등"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {toast && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <p className="text-sm text-green-700 font-semibold">수정되었습니다</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2 sticky bottom-0 bg-white pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
