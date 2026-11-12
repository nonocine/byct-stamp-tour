'use client'
/**
 * 슈퍼관리자 — 특별상 대상자(스탬프 2개 이상) · 우수작 명단 · 소감문 자료집(Word).
 */
import { useCallback, useEffect, useState } from 'react'
import { Download, FileDown, Loader2, RefreshCw } from 'lucide-react'
import { ORGANIZATIONS } from '@/lib/data'
import { ESSAY_QUESTIONS, type EssayRow } from '@/lib/essay'
import { SPECIAL_AWARD_MIN_STAMPS } from '@/lib/smsText'
import { downloadCsv, todayStamp } from '@/lib/csv'
import { downloadEssayBookDocx } from '@/lib/reportDocx'
import { formatDate, formatPhone } from './shared'

interface SpecialRow {
  participant_id: string
  name: string
  phone: string
  stamp_count: number
  centers: { center_id: number; center_name: string }[]
  has_essay: boolean
  essay_center_name: string | null
  is_excellent: boolean
}

async function fetchEssays(excellentOnly: boolean): Promise<EssayRow[]> {
  const res = await fetch(`/api/admin/essays${excellentOnly ? '?excellent=1' : ''}`, { cache: 'no-store' })
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? '소감문을 불러오지 못했습니다.')
  return (payload?.essays ?? []) as EssayRow[]
}

export default function EssaySpecialPanel() {
  const [rows, setRows] = useState<SpecialRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/essays/special', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? '명단을 불러오지 못했습니다.')
      setRows((payload?.participants ?? []) as SpecialRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : '명단을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function downloadSpecialCsv() {
    downloadCsv(
      `BYCT_특별상대상자_${todayStamp()}.csv`,
      ['번호', '이름', '전화번호', '스탬프 수', '받은 기관', '소감문 작성', '소감문 기관', '우수작'],
      rows.map((r, i) => [
        i + 1,
        r.name,
        formatPhone(r.phone),
        r.stamp_count,
        r.centers.map(c => c.center_name).join(' / '),
        r.has_essay ? 'O' : 'X',
        r.essay_center_name ?? '',
        r.is_excellent ? 'O' : '',
      ]),
    )
  }

  async function downloadExcellentCsv() {
    setBusy('excellent')
    try {
      const list = await fetchEssays(true)
      if (list.length === 0) { alert('아직 선정된 우수작이 없습니다.'); return }
      const order = new Map(ORGANIZATIONS.map((o, i) => [o.id, i]))
      list.sort((a, b) => (order.get(a.center_id) ?? 99) - (order.get(b.center_id) ?? 99))
      downloadCsv(
        `BYCT_우수작명단_${todayStamp()}.csv`,
        ['번호', '이름', '전화번호', '선정 기관', '선정자', '선정일'],
        list.map((e, i) => [
          i + 1,
          e.participant_name,
          formatPhone(e.participant_phone ?? ''),
          e.center_name,
          e.excellent_by ?? '',
          e.excellent_at ? formatDate(e.excellent_at) : '',
        ]),
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
    } finally {
      setBusy(null)
    }
  }

  async function downloadBook() {
    setBusy('book')
    try {
      const list = await fetchEssays(false)
      if (list.length === 0) { alert('아직 들어온 소감문이 없습니다.'); return }
      await downloadEssayBookDocx(
        list
          .sort((a, b) => Number(b.is_excellent) - Number(a.is_excellent) || a.participant_name.localeCompare(b.participant_name, 'ko'))
          .map(e => ({
            participant_name: e.participant_name,
            center_id: e.center_id,
            center_name: e.center_name,
            is_excellent: e.is_excellent,
            photo_url: e.photo_url,
            sections: ESSAY_QUESTIONS.map(q => ({ title: q.title, body: e[q.key] ?? '' })),
          })),
        `BYCT_소감문자료집_${todayStamp()}.docx`,
        {
          title: 'B.Y.C.T 스탬프투어 소감문 자료집',
          centerOrder: ORGANIZATIONS.map(o => o.id),
          onProgress: (d, t) => setBusy(`book:${d}/${t}`),
        },
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Word 파일을 만들지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  const written = rows.filter(r => r.has_essay).length

  return (
    <div className="space-y-4">
      {/* 내려받기 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2">
        <p className="text-sm font-bold text-gray-900">내려받기</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <button
            onClick={downloadSpecialCsv}
            disabled={rows.length === 0}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold disabled:opacity-50"
          >
            <Download size={14} /> 특별상 대상자 CSV
          </button>
          <button
            onClick={downloadExcellentCsv}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'excellent' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 우수작 명단 CSV
          </button>
          <button
            onClick={downloadBook}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy?.startsWith('book') ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {busy?.startsWith('book:') ? `자료집 만드는 중 ${busy.slice(5)}` : '소감문 자료집 Word'}
          </button>
        </div>
        <p className="text-xs text-gray-400">자료집은 기관별로 묶이고 소감문 1편이 1쪽입니다(우수작 먼저). 사진이 많으면 1~2분 걸릴 수 있어요.</p>
      </div>

      {/* 특별상 대상자 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-900">특별상 대상자 (스탬프 {SPECIAL_AWARD_MIN_STAMPS}개 이상)</p>
            <p className="text-xs text-gray-500">{rows.length}명 · 소감문 작성 {written}명 / 미작성 {rows.length - written}명</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-gray-100 text-gray-600" aria-label="새로고침">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 text-left font-semibold">이름</th>
                <th className="py-2 text-left font-semibold">전화번호</th>
                <th className="py-2 text-center font-semibold">스탬프</th>
                <th className="py-2 text-left font-semibold">받은 기관</th>
                <th className="py-2 text-center font-semibold">소감문</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.participant_id} className="border-b border-gray-50 align-top">
                  <td className="py-2 font-semibold text-gray-900 whitespace-nowrap">{r.name}</td>
                  <td className="py-2 text-gray-600 whitespace-nowrap">{formatPhone(r.phone)}</td>
                  <td className="py-2 text-center font-bold text-indigo-700">{r.stamp_count}</td>
                  <td className="py-2 text-xs text-gray-600">{r.centers.map(c => c.center_name).join(', ')}</td>
                  <td className="py-2 text-center whitespace-nowrap">
                    {r.has_essay
                      ? <span className="text-xs font-bold text-green-700">{r.is_excellent ? '★ 우수' : '작성'}</span>
                      : <span className="text-xs text-gray-400">미작성</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && !error && (
            <p className="py-8 text-center text-sm text-gray-400">대상자가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
