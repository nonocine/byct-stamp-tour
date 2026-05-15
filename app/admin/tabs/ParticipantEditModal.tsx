'use client'
import { Edit2, X, Save } from 'lucide-react'
import { formatPhone } from './shared'

interface Props {
  form: { name: string; phone: string; birthdate: string }
  onChange: (next: { name: string; phone: string; birthdate: string }) => void
  saving: boolean
  saveError: string
  onClose: () => void
  onSave: () => void
}

export default function ParticipantEditModal({ form, onChange, saving, saveError, onClose, onSave }: Props) {
  const close = () => { if (!saving) onClose() }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Edit2 size={15} /> 참가자 정보 수정
          </h3>
          <button
            onClick={close}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={e => onChange({ ...form, name: e.target.value })}
              placeholder="이름"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">전화번호</label>
            <input
              type="tel" inputMode="numeric"
              value={form.phone}
              onChange={e => onChange({ ...form, phone: formatPhone(e.target.value) })}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">생년월일</label>
            <input
              type="text" inputMode="numeric"
              value={form.birthdate}
              onChange={e => onChange({ ...form, birthdate: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              placeholder="20010101"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={close}
            disabled={saving}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save size={14} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
