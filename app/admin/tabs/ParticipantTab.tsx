'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  Users, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  X, Edit2, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import { deleteParticipantsCascade, fetchAllParticipantIds } from '@/lib/participants'
import { exportParticipantsExcel } from '@/lib/exportParticipants'
import OrgIcon from '@/components/OrgIcon'
import type { AdminUser } from '@/components/AdminProvider'
import {
  PARTICIPANTS_PAGE_SIZE,
  buildPageList,
  formatPhone,
  formatBirthdate,
  formatDate,
  type ParticipantRow,
  type StampRecordRow,
} from './shared'
import BulkDeleteModal from './BulkDeleteModal'
import ParticipantEditModal from './ParticipantEditModal'

interface Props {
  admin: AdminUser
}

export default function ParticipantTab({ admin }: Props) {
  const [pSearch, setPSearch] = useState('')
  const [pCenterId, setPCenterId] = useState<number | null>(
    admin.role === 'center' ? (admin.center_id ?? null) : null,
  )
  const [pList, setPList] = useState<ParticipantRow[]>([])
  const [pLoading, setPLoading] = useState(false)
  const [pPage, setPPage] = useState(0)
  const [pTotal, setPTotal] = useState(0)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', birthdate: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [expandedPId, setExpandedPId] = useState<string | null>(null)
  const [pStamps, setPStamps] = useState<StampRecordRow[]>([])
  const [pStampsLoading, setPStampsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ── 참가자 일괄/선택 삭제 (슈퍼관리자 전용) ──────────────────────────
  const [selectedPIds, setSelectedPIds] = useState<Set<string>>(new Set())
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'selected' | 'all' | null>(null)
  const [bulkDeleteText, setBulkDeleteText] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState('')
  const [allProfileIds, setAllProfileIds] = useState<string[]>([])
  const [deleteToast, setDeleteToast] = useState('')
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false)

  function togglePSelect(id: string) {
    setSelectedPIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllParticipants() {
    setSelectedPIds(prev => {
      const allIds = pList.map(p => p.id)
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(allIds)
    })
  }

  async function openDeleteAllModal() {
    if (admin.role !== 'super') return
    setBulkDeleteText('')
    setBulkDeleteError('')
    try {
      const ids = await fetchAllParticipantIds()
      setAllProfileIds(ids)
      setBulkDeleteMode('all')
    } catch (e: any) {
      alert(e?.message ?? '참가자 목록 조회에 실패했습니다')
    }
  }

  function openDeleteSelectedModal() {
    if (admin.role !== 'super' || selectedPIds.size === 0) return
    setBulkDeleteText('')
    setBulkDeleteError('')
    setBulkDeleteMode('selected')
  }

  function closeBulkDeleteModal() {
    if (bulkDeleting) return
    setBulkDeleteMode(null)
    setBulkDeleteText('')
    setBulkDeleteError('')
  }

  const loadParticipants = useCallback(async (p: number, search: string, centerId: number | null) => {
    setPLoading(true)
    setSelectedPIds(new Set())
    try {
      const effectiveCenterId = admin.role === 'center' ? (admin.center_id ?? null) : centerId
      if (admin.role === 'center' && !admin.center_id) {
        setPList([])
        setPTotal(0)
        return
      }

      let filterIds: string[] | null = null
      if (effectiveCenterId !== null) {
        const { data: pidRows } = await supabase
          .from('stamp_records')
          .select('participant_id')
          .eq('center_id', effectiveCenterId)
        filterIds = Array.from(
          new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
        )
        if (filterIds.length === 0) {
          setPList([])
          setPTotal(0)
          return
        }
      }

      let query = supabase
        .from('profiles')
        .select('id, name, phone, birthdate, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filterIds) query = query.in('id', filterIds)

      const term = search.trim()
      if (term) {
        const raw = term.replace(/\D/g, '')
        const isNumericOnly = raw.length > 0 && raw.length === term.replace(/[\s-]/g, '').length
        if (isNumericOnly) {
          query = query.ilike('phone', `%${raw}%`)
        } else if (raw.length >= 3) {
          query = query.or(`name.ilike.%${term}%,phone.ilike.%${raw}%`)
        } else {
          query = query.ilike('name', `%${term}%`)
        }
      }

      const { data: profiles, count } = await query
      if (!profiles) return
      setPTotal(count ?? 0)

      const ids = profiles.map(pr => pr.id)
      const { data: stampData } = ids.length > 0
        ? await supabase.from('stamp_records').select('participant_id').in('participant_id', ids)
        : { data: [] }

      const countById: Record<string, number> = {}
      ;(stampData ?? []).forEach((s: any) => {
        if (s.participant_id) countById[s.participant_id] = (countById[s.participant_id] ?? 0) + 1
      })
      setPList(profiles.map(pr => ({ ...pr, stampCount: countById[pr.id] ?? 0 })))
    } finally {
      setPLoading(false)
    }
  }, [admin])

  // 진입 시 1회 + centerId 변경 시 자동 fetch
  useEffect(() => {
    setPPage(0)
    setPSearch('')
    loadParticipants(0, '', pCenterId)
  }, [pCenterId, loadParticipants])

  async function loadParticipantStamps(participantId: string) {
    setPStampsLoading(true)
    try {
      const { data } = await supabase
        .from('stamp_records')
        .select('*')
        .eq('participant_id', participantId)

      const stamps = (data ?? [])
        .map((s: any) => ({
          id: s.id,
          center_id: s.center_id,
          center_name: s.center_name,
          approved_by: s.approved_by,
          stamped_at: s.stamped_at,
        }))
        .sort((a, b) => new Date(b.stamped_at).getTime() - new Date(a.stamped_at).getTime())

      setPStamps(stamps)
    } finally {
      setPStampsLoading(false)
    }
  }

  async function handleConfirmBulkDelete() {
    if (admin.role !== 'super') return
    if (bulkDeleteText !== 'DELETE') return
    const ids = bulkDeleteMode === 'all' ? allProfileIds : Array.from(selectedPIds)
    if (ids.length === 0) return

    setBulkDeleting(true)
    setBulkDeleteError('')
    try {
      await deleteParticipantsCascade(ids)
      setBulkDeleteMode(null)
      setBulkDeleteText('')
      setSelectedPIds(new Set())
      setExpandedPId(null)
      setPPage(0)
      setDeleteToast(`${ids.length}명 삭제 완료`)
      setTimeout(() => setDeleteToast(''), 4000)
      loadParticipants(0, pSearch, pCenterId)
    } catch (e: any) {
      setBulkDeleteError(e?.message ?? '삭제에 실패했습니다')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleSaveParticipant() {
    if (!editId || admin.role !== 'super') return
    setSaveError('')
    const { name, phone, birthdate } = editForm
    const trimmedName = name.trim()
    if (!trimmedName) { setSaveError('이름을 입력해주세요'); return }
    const rawPhone = phone.replace(/\D/g, '')
    if (rawPhone.length < 10) { setSaveError('올바른 전화번호를 입력해주세요'); return }
    const rawBirth = birthdate.replace(/\D/g, '')
    if (rawBirth.length !== 8) { setSaveError('생년월일 8자리를 입력해주세요 (예: 20010101)'); return }

    setSaving(true)
    try {
      const { data: dup } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', rawPhone)
        .neq('id', editId)
        .maybeSingle()
      if (dup) { setSaveError('이미 사용 중인 전화번호입니다'); return }

      const { error } = await supabase.from('profiles').update({
        name: trimmedName,
        phone: rawPhone,
        birthdate: rawBirth,
      }).eq('id', editId)
      if (error) throw error

      await supabase.from('stamp_records').update({
        participant_name: trimmedName,
        participant_phone: rawPhone,
      }).eq('participant_id', editId)

      setEditId(null)
      loadParticipants(pPage, pSearch, pCenterId)
    } catch (e: any) {
      setSaveError(e.message ?? '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteParticipant(p: ParticipantRow) {
    if (admin.role !== 'super') return
    if (!confirm(`"${p.name}" 참가자를 삭제하면 스탬프/리뷰/신청/푸시구독 기록도 함께 삭제됩니다.\n정말 삭제하시겠습니까?`)) return
    try {
      await deleteParticipantsCascade([p.id])
      if (expandedPId === p.id) setExpandedPId(null)
      loadParticipants(pPage, pSearch, pCenterId)
    } catch (e: any) {
      alert('삭제에 실패했습니다: ' + (e.message ?? ''))
    }
  }

  async function handleDeleteStamp(sr: StampRecordRow, participantId: string) {
    if (admin.role !== 'super') return
    if (!confirm(`이 스탬프 기록을 삭제할까요?\n(${sr.center_name})`)) return
    const { error } = await supabase.from('stamp_records').delete().eq('id', sr.id)
    if (error) { alert('삭제 실패: ' + error.message); return }

    const { error: appErr } = await supabase
      .from('applications')
      .delete()
      .eq('participant_id', participantId)
      .eq('center_id', sr.center_id)
    if (appErr) console.warn('[취소] applications 삭제 실패:', appErr.message)

    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        title: 'B.Y.C.T 스탬프투어',
        body: `⚠️ ${sr.center_name} 스탬프가 취소되었습니다`,
        tag: `stamp-cancel-${sr.id}`,
        url: '/stamps',
      }),
    }).catch((err) => console.warn('[push] 발송 실패:', err))

    setPStamps(prev => prev.filter(s => s.id !== sr.id))
    loadParticipants(pPage, pSearch, pCenterId)
  }

  async function handleExportExcel() {
    setExporting(true)
    try {
      const centerId = admin.role === 'center' ? admin.center_id : pCenterId
      await exportParticipantsExcel(centerId)
    } catch (e: any) {
      alert('다운로드 실패: ' + (e.message ?? ''))
    } finally {
      setExporting(false)
    }
  }

  const pTotalPages = Math.ceil(pTotal / PARTICIPANTS_PAGE_SIZE)

  return (
    <div className="px-4 space-y-4">
      {admin.role === 'center' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에서 스탬프를 받은 참가자만 조회됩니다.
          </p>
          <p className="text-xs text-blue-600 mt-0.5">조회 전용 — 수정/삭제는 슈퍼관리자만 가능합니다.</p>
        </div>
      )}

      {admin.role === 'super' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 필터</label>
          <select
            value={pCenterId ?? ''}
            onChange={e => {
              const v = e.target.value
              setPCenterId(v === '' ? null : Number(v))
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="">전체 참가자</option>
            {ORGANIZATIONS.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={pSearch}
          onChange={e => setPSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPPage(0); loadParticipants(0, pSearch, pCenterId) } }}
          placeholder="이름 또는 전화번호 검색"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
        <button
          onClick={() => { setPPage(0); loadParticipants(0, pSearch, pCenterId) }}
          className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Search size={16} />
        </button>
        {pSearch && (
          <button
            onClick={() => { setPSearch(''); setPPage(0); loadParticipants(0, '', pCenterId) }}
            className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {exporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
          {exporting ? '다운로드 중...' : '엑셀 다운로드'}
        </button>
      </div>

      {deleteToast && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-semibold">
          ✓ {deleteToast}
        </div>
      )}

      {admin.role === 'super' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={openDeleteSelectedModal}
            disabled={selectedPIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} /> 선택 삭제 ({selectedPIds.size}명)
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 min-w-0">
            <Users size={15} className="flex-shrink-0" />
            <span className="truncate">
              {pCenterId === null
                ? '전체 참가자'
                : `${ORGANIZATIONS.find(o => o.id === pCenterId)?.name ?? ''} 참가자`}
            </span>
            {!pLoading && <span className="text-xs text-gray-400 font-normal flex-shrink-0">전체 {pTotal}명</span>}
          </h2>
          <button onClick={() => loadParticipants(pPage, pSearch, pCenterId)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={13} className={pLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {admin.role === 'super' && !pLoading && pList.length > 0 && (
          <label className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pList.length > 0 && pList.every(p => selectedPIds.has(p.id))}
              onChange={toggleSelectAllParticipants}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-xs font-medium text-gray-500">
              전체 선택 ({selectedPIds.size}/{pList.length})
            </span>
          </label>
        )}

        {pLoading ? (
          <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
        ) : pList.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {pSearch
              ? '검색 결과가 없습니다'
              : pCenterId !== null
                ? '해당 기관에서 스탬프를 받은 참가자가 없습니다'
                : '등록된 참가자가 없습니다'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pList
              .slice(pPage * PARTICIPANTS_PAGE_SIZE, (pPage + 1) * PARTICIPANTS_PAGE_SIZE)
              .map(p => (
              <div key={p.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  {admin.role === 'super' && (
                    <input
                      type="checkbox"
                      checked={selectedPIds.has(p.id)}
                      onChange={() => togglePSelect(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      {admin.role === 'super' && (
                        <button
                          onClick={() => { setEditId(p.id); setEditForm({ name: p.name, phone: formatPhone(p.phone), birthdate: p.birthdate ?? '' }); setSaveError(''); setExpandedPId(null) }}
                          className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      <span className="text-xs font-bold text-blue-600 flex-shrink-0 ml-auto">
                        {p.stampCount}<span className="font-normal text-gray-400">/17</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatPhone(p.phone)} · {formatBirthdate(p.birthdate)} · {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {admin.role === 'super' && (
                      <button
                        onClick={() => handleDeleteParticipant(p)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (expandedPId === p.id) { setExpandedPId(null); return }
                        setExpandedPId(p.id)
                        await loadParticipantStamps(p.id)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="스탬프 기록"
                    >
                      {expandedPId === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedPId === p.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {pStampsLoading ? (
                      <div className="py-3 flex justify-center"><RefreshCw size={14} className="animate-spin text-gray-300" /></div>
                    ) : pStamps.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">스탬프 기록이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 mb-2">스탬프 기록 ({pStamps.length}개)</p>
                        {pStamps.map(sr => {
                          const org = ORGANIZATIONS.find(o => o.id === sr.center_id)
                          return (
                            <div key={sr.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                              {org && <OrgIcon org={org} size={28} rounded="rounded-lg" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{sr.center_name}</p>
                                <p className="text-xs text-gray-400">{formatDate(sr.stamped_at)} · {sr.approved_by}</p>
                              </div>
                              {admin.role === 'super' && (
                                <button
                                  onClick={() => handleDeleteStamp(sr, p.id)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                  title="스탬프 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {pTotalPages > 1 && !pLoading && (
          <div className="px-3 py-3.5 border-t border-gray-100 flex items-center justify-center gap-1 flex-wrap">
            <button
              onClick={() => setPPage(p => Math.max(0, p - 1))}
              disabled={pPage === 0}
              className="flex items-center gap-1 px-2.5 h-7 text-xs font-semibold text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={13} /> 이전
            </button>
            {buildPageList(pPage, pTotalPages).map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-xs text-gray-400">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPPage(item)}
                  className={`min-w-[28px] h-7 px-2 text-xs font-semibold rounded-md transition-colors ${
                    item === pPage
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item + 1}
                </button>
              ),
            )}
            <button
              onClick={() => setPPage(p => Math.min(pTotalPages - 1, p + 1))}
              disabled={pPage >= pTotalPages - 1}
              className="flex items-center gap-1 px-2.5 h-7 text-xs font-semibold text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              다음 <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 위험 구역 (슈퍼관리자 전용) */}
      {admin.role === 'super' && (
        <div className="border border-red-300 bg-red-50/60 rounded-2xl overflow-hidden">
          <button
            onClick={() => setDangerZoneOpen(o => !o)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-red-50 transition-colors"
          >
            <div>
              <h3 className="text-sm font-bold text-red-700">⚠️ 위험 구역</h3>
              <p className="text-xs text-red-500 mt-0.5">
                아래 작업은 되돌릴 수 없습니다. 신중히 진행하세요.
              </p>
            </div>
            {dangerZoneOpen
              ? <ChevronUp size={16} className="text-red-400 flex-shrink-0" />
              : <ChevronDown size={16} className="text-red-400 flex-shrink-0" />}
          </button>
          {dangerZoneOpen && (
            <div className="px-5 pb-4 pt-1 border-t border-red-200">
              <button
                onClick={openDeleteAllModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 active:scale-95 transition-all"
              >
                <Trash2 size={13} /> 모든 참가자 데이터 삭제
              </button>
            </div>
          )}
        </div>
      )}

      {bulkDeleteMode && admin.role === 'super' && (
        <BulkDeleteModal
          mode={bulkDeleteMode}
          selectedCount={selectedPIds.size}
          allCount={allProfileIds.length}
          text={bulkDeleteText}
          onTextChange={setBulkDeleteText}
          busy={bulkDeleting}
          error={bulkDeleteError}
          onClose={closeBulkDeleteModal}
          onConfirm={handleConfirmBulkDelete}
        />
      )}

      {editId && admin.role === 'super' && (
        <ParticipantEditModal
          form={editForm}
          onChange={setEditForm}
          saving={saving}
          saveError={saveError}
          onClose={() => { setEditId(null); setSaveError('') }}
          onSave={handleSaveParticipant}
        />
      )}
    </div>
  )
}
