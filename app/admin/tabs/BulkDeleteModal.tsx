'use client'
import { Trash2, X, RefreshCw } from 'lucide-react'

interface Props {
  mode: 'selected' | 'all'
  selectedCount: number
  allCount: number
  text: string
  onTextChange: (v: string) => void
  busy: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}

export default function BulkDeleteModal({
  mode, selectedCount, allCount, text, onTextChange, busy, error, onClose, onConfirm,
}: Props) {
  const ready =
    text === 'DELETE' &&
    !busy &&
    (mode === 'all' ? allCount > 0 : selectedCount > 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
            <Trash2 size={16} />
            {mode === 'all' ? '모든 참가자 데이터 삭제' : '선택 참가자 삭제'}
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700 leading-relaxed">
              {mode === 'all'
                ? `현재 가입된 참가자 ${allCount}명과 모든 스탬프/리뷰/신청/푸시구독 기록이 영구 삭제됩니다. 복구할 수 없습니다.`
                : `선택한 참가자 ${selectedCount}명과 그 참가자들의 모든 스탬프/리뷰/신청/푸시구독 기록이 영구 삭제됩니다. 복구할 수 없습니다.`}
            </p>
            <p className="text-xs text-red-500 mt-1.5">※ 관리자 계정은 삭제되지 않습니다.</p>
          </div>
          <p className="text-xs text-gray-500">
            계속하려면 아래에 <span className="font-bold text-gray-900">DELETE</span> 를 정확히 입력하세요.
          </p>
          <input
            type="text"
            value={text}
            onChange={e => onTextChange(e.target.value)}
            placeholder="DELETE"
            autoFocus
            disabled={busy}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {busy ? '삭제 중...' : '영구 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
