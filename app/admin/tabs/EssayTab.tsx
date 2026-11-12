'use client'
/**
 * 관리자 — 소감문 탭.
 *   센터관리자: 본인 기관으로 들어온 소감문 목록·상세(사진 포함) + 우수작 선정/해제.
 *   슈퍼관리자: 전체 + 기관 필터 + 우수작만 보기, 그리고
 *              [특별상·자료집] [문자 공지] 하위 화면.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, ChevronDown, ChevronUp, Download, FileText, MessageSquare, RefreshCw, Trophy } from 'lucide-react'
import { ORGANIZATIONS } from '@/lib/data'
import type { AdminUser } from '@/components/AdminProvider'
import { ESSAY_QUESTIONS, type EssayRow } from '@/lib/essay'
import { downloadCsv, todayStamp } from '@/lib/csv'
import { formatDate, formatPhone } from './shared'
import EssaySpecialPanel from './EssaySpecialPanel'
import EssaySmsPanel from './EssaySmsPanel'

type View = 'list' | 'special' | 'sms'

export default function EssayTab({ admin }: { admin: AdminUser }) {
  const isSuper = admin.role === 'super'
  const [view, setView] = useState<View>('list')

  return (
    <div className="px-4 space-y-4">
      {isSuper && (
        <div className="grid grid-cols-3 gap-2">
          {([
            ['list', '소감문 목록', FileText],
            ['special', '특별상·자료집', Trophy],
            ['sms', '문자 공지', MessageSquare],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 ${view === k ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {view === 'list' && <EssayList admin={admin} />}
      {isSuper && view === 'special' && <EssaySpecialPanel />}
      {isSuper && view === 'sms' && <EssaySmsPanel />}
    </div>
  )
}

function EssayList({ admin }: { admin: AdminUser }) {
  const isSuper = admin.role === 'super'
  const [essays, setEssays] = useState<EssayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [centerFilter, setCenterFilter] = useState<number | 'all'>('all')
  const [excellentOnly, setExcellentOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (isSuper && centerFilter !== 'all') q.set('centerId', String(centerFilter))
      if (excellentOnly) q.set('excellent', '1')
      const res = await fetch(`/api/admin/essays?${q.toString()}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? '소감문을 불러오지 못했습니다.')
      setEssays((payload?.essays ?? []) as EssayRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : '소감문을 불러오지 못했습니다.')
      setEssays([])
    } finally {
      setLoading(false)
    }
  }, [isSuper, centerFilter, excellentOnly])

  useEffect(() => { load() }, [load])

  async function toggleExcellent(e: EssayRow) {
    const next = !e.is_excellent
    if (!next && !confirm(`${e.participant_name} 님의 우수작 선정을 해제할까요?`)) return
    setSavingId(e.id)
    try {
      const res = await fetch('/api/admin/essays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id, excellent: next }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) { alert(payload?.error ?? '저장에 실패했습니다.'); return }
      setEssays(prev => {
        const updated = prev.map(x => (x.id === e.id ? { ...x, ...payload.essay } : x))
        return excellentOnly ? updated.filter(x => x.is_excellent) : updated
      })
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  const excellentCount = useMemo(() => essays.filter(e => e.is_excellent).length, [essays])

  function downloadExcellentCsv() {
    const rows = essays.filter(e => e.is_excellent)
    if (rows.length === 0) { alert('우수작이 없습니다.'); return }
    downloadCsv(
      `BYCT_우수작명단_${todayStamp()}.csv`,
      ['번호', '이름', '전화번호', '선정 기관', '선정자', '선정일'],
      rows.map((e, i) => [
        i + 1,
        e.participant_name,
        formatPhone(e.participant_phone ?? ''),
        e.center_name,
        e.excellent_by ?? '',
        e.excellent_at ? formatDate(e.excellent_at) : '',
      ]),
    )
  }

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {isSuper ? '전체 소감문' : `${admin.center_name ?? '우리 기관'} 소감문`}
            </p>
            <p className="text-xs text-gray-500">
              {essays.length}편 · 우수작 {excellentCount}편
              {!isSuper && ' — 참가자가 우리 기관을 골라 쓴 소감문입니다.'}
            </p>
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-gray-100 text-gray-600" aria-label="새로고침">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuper && (
            <select
              value={centerFilter}
              onChange={e => setCenterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">전체 기관</option>
              {ORGANIZATIONS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-700 px-2">
            <input type="checkbox" checked={excellentOnly} onChange={e => setExcellentOnly(e.target.checked)} />
            우수작만 보기
          </label>
          {isSuper && (
            <button
              onClick={downloadExcellentCsv}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-lg"
              title="지금 목록(필터 적용)의 우수작만 내려받습니다"
            >
              <Download size={13} /> 우수작 명단 CSV
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
      {!loading && !error && essays.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">아직 들어온 소감문이 없습니다.</p>
      )}

      {/* 목록 */}
      <ul className="space-y-2">
        {essays.map(e => {
          const open = openId === e.id
          return (
            <li key={e.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${e.is_excellent ? 'border-amber-300' : 'border-gray-100'}`}>
              <button onClick={() => setOpenId(open ? null : e.id)} className="w-full flex items-center gap-3 p-4 text-left">
                {e.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-gray-900">{e.participant_name}</p>
                    {e.is_excellent && (
                      <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">★ 우수작</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {isSuper && `${e.center_name} · `}{formatDate(e.updated_at ?? e.created_at)} · {e.q_activity.slice(0, 40)}
                  </p>
                </div>
                {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-4">
                  {e.photo_url && (
                    <a href={e.photo_url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.photo_url} alt={`${e.participant_name} 사진`} className="w-full max-h-96 object-contain rounded-xl bg-gray-50" />
                    </a>
                  )}
                  {ESSAY_QUESTIONS.map(q => (e[q.key] ?? '').trim() ? (
                    <div key={q.key}>
                      <p className="text-xs font-bold text-indigo-700 mb-1">{q.title}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{e[q.key]}</p>
                    </div>
                  ) : null)}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-gray-400">
                      {e.is_excellent && e.excellent_by
                        ? `${e.excellent_by} · ${e.excellent_at ? formatDate(e.excellent_at) : ''} 선정`
                        : `작성 ${formatDate(e.created_at)}`}
                    </p>
                    {(isSuper || admin.center_id === e.center_id) && (
                      <button
                        onClick={() => toggleExcellent(e)}
                        disabled={savingId === e.id}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${e.is_excellent ? 'bg-gray-100 text-gray-700' : 'bg-amber-500 text-white'}`}
                      >
                        <Award size={15} /> {e.is_excellent ? '우수작 해제' : '우수작 선정'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
