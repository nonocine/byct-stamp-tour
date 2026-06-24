'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Upload, RefreshCw, FileText, ExternalLink, Trash2, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import ReportManager from '@/components/ReportManager'
import type { AdminUser } from '@/components/AdminProvider'
import { formatDate } from './shared'

interface Props {
  admin: AdminUser
}

interface GlobalPlanRow {
  id: string
  title: string
  pdf_url: string
  uploaded_by: string
  created_at: string
}

interface SavedReportRow {
  id: string
  scope: 'center' | 'global'
  center_id: number | null
  title: string
  created_by: string
  created_at: string
}

export default function ReportTab({ admin }: Props) {
  const initialScope: 'center' | 'global' = admin.role === 'center' ? 'center' : 'global'
  const initialCenterId = admin.role === 'center' ? (admin.center_id ?? null) : null
  const [reportScope, setReportScope] = useState<'center' | 'global'>(initialScope)
  const [reportCenterId, setReportCenterId] = useState<number | null>(initialCenterId)

  const [globalPlans, setGlobalPlans] = useState<GlobalPlanRow[]>([])
  const [globalPlansLoading, setGlobalPlansLoading] = useState(false)
  const [gpTitle, setGpTitle] = useState('')
  const [gpUploading, setGpUploading] = useState(false)
  const gpInputRef = useRef<HTMLInputElement>(null)

  const [savedReports, setSavedReports] = useState<SavedReportRow[]>([])
  const [savedReportsLoading, setSavedReportsLoading] = useState(false)
  const [loadedReport, setLoadedReport] = useState<{ markdown: string; key: string } | null>(null)

  function canAccessReport(row: { scope: 'center' | 'global'; center_id: number | null }): boolean {
    if (admin.role === 'super') return true
    if (!admin.center_id) return false
    return row.scope === 'center' && row.center_id === admin.center_id
  }

  async function loadGlobalPlans() {
    setGlobalPlansLoading(true)
    try {
      const { data } = await supabase
        .from('global_plans')
        .select('id, title, pdf_url, uploaded_by, created_at')
        .order('created_at', { ascending: false })
      setGlobalPlans((data ?? []) as GlobalPlanRow[])
    } finally {
      setGlobalPlansLoading(false)
    }
  }

  async function loadSavedReports() {
    setSavedReportsLoading(true)
    try {
      let query
      if (admin.role === 'center') {
        if (!admin.center_id) {
          setSavedReports([])
          return
        }
        query = supabase
          .from('reports')
          .select('id, scope, center_id, title, created_by, created_at')
          .eq('scope', 'center')
          .eq('center_id', admin.center_id)
          .order('created_at', { ascending: false })
      } else {
        query = supabase
          .from('reports')
          .select('id, scope, center_id, title, created_by, created_at')
          .order('created_at', { ascending: false })
      }
      const { data, error } = await query
      if (error) throw error

      const rows = ((data ?? []) as SavedReportRow[]).filter(canAccessReport)
      setSavedReports(rows)
    } catch (e: any) {
      console.error('[loadSavedReports]', e)
      setSavedReports([])
    } finally {
      setSavedReportsLoading(false)
    }
  }

  function triggerGpUpload() {
    if (admin.role !== 'super') return
    if (!gpTitle.trim()) {
      alert('계획서 제목을 먼저 입력해주세요.')
      return
    }
    if (gpInputRef.current) gpInputRef.current.value = ''
    gpInputRef.current?.click()
  }

  async function handleGpFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || admin.role !== 'super') return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      alert('PDF만 업로드 가능합니다.')
      return
    }
    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert(`파일 크기가 너무 큽니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)\n20MB 이하의 PDF만 업로드 가능합니다.`)
      return
    }
    const title = gpTitle.trim()
    if (!title) {
      alert('계획서 제목을 입력해주세요.')
      return
    }

    setGpUploading(true)
    try {
      const path = `global/${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage
        .from('program-plans')
        .upload(path, file, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('program-plans').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('global_plans').insert({
        title,
        pdf_url: pub.publicUrl,
        uploaded_by: admin.name,
      })
      if (dbErr) throw dbErr

      setGpTitle('')
      loadGlobalPlans()
    } catch (err: any) {
      alert(`전체 계획서 업로드 실패: ${err?.message ?? err}`)
    } finally {
      setGpUploading(false)
    }
  }

  async function handleDeleteGp(plan: GlobalPlanRow) {
    if (admin.role !== 'super') return
    if (!confirm(`"${plan.title}" 전체 계획서를 삭제하시겠습니까?`)) return
    try {
      const marker = '/program-plans/'
      const idx = plan.pdf_url.indexOf(marker)
      if (idx >= 0) {
        const p = plan.pdf_url.slice(idx + marker.length)
        const { error: rmErr } = await supabase.storage.from('program-plans').remove([p])
        if (rmErr) console.warn('[전체 계획서] Storage 제거 실패:', rmErr.message)
      }
      const { error: delErr } = await supabase.from('global_plans').delete().eq('id', plan.id)
      if (delErr) throw delErr
      loadGlobalPlans()
    } catch (err: any) {
      alert(`삭제 실패: ${err?.message ?? err}`)
    }
  }

  async function handleLoadSavedReport(row: SavedReportRow) {
    if (!canAccessReport(row)) {
      alert('본인 기관 보고서만 불러올 수 있습니다.')
      return
    }
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('content_md')
        .eq('id', row.id)
        .single()
      if (error) throw error
      if (!data) return

      if (row.scope === 'global') {
        setReportScope('global')
        setReportCenterId(null)
      } else {
        setReportScope('center')
        setReportCenterId(row.center_id)
      }
      setLoadedReport({ markdown: data.content_md as string, key: `${row.id}-${Date.now()}` })
    } catch (e: any) {
      alert(`보고서 불러오기 실패: ${e?.message ?? e}`)
    }
  }

  async function handleDeleteSavedReport(row: SavedReportRow) {
    if (!canAccessReport(row)) {
      alert('본인 기관 보고서만 삭제할 수 있습니다.')
      return
    }
    if (!confirm(`"${row.title}"\n이 보고서를 삭제하시겠습니까?`)) return
    try {
      if (admin.role === 'center' && admin.center_id) {
        const { data: target, error: chkErr } = await supabase
          .from('reports')
          .select('scope, center_id')
          .eq('id', row.id)
          .maybeSingle()
        if (chkErr) throw chkErr
        if (!target || target.scope !== 'center' || target.center_id !== admin.center_id) {
          alert('본인 기관 보고서만 삭제할 수 있습니다.')
          return
        }
      }
      const { error } = await supabase.from('reports').delete().eq('id', row.id)
      if (error) throw error
      setSavedReports(prev => prev.filter(r => r.id !== row.id))
    } catch (e: any) {
      alert(`삭제 실패: ${e?.message ?? e}`)
    }
  }

  useEffect(() => {
    if (admin.role === 'super') loadGlobalPlans()
    loadSavedReports()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-4 space-y-4">
      <input
        ref={gpInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleGpFileSelected}
      />

      {admin.role === 'super' && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <label className="block text-xs font-semibold text-gray-600 mb-2 px-1">보고서 종류</label>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setReportScope('global'); setReportCenterId(null) }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  reportScope === 'global'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                📊 전체 통합 보고서
              </button>
              <button
                onClick={() => setReportScope('center')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  reportScope === 'center'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🏢 기관별 보고서
              </button>
            </div>
          </div>

          {reportScope === 'center' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 선택</label>
              <select
                value={reportCenterId ?? ''}
                onChange={e => setReportCenterId(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— 기관을 선택해주세요 —</option>
                {ORGANIZATIONS.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                📎 전체 계획서 PDF (슈퍼관리자 전용)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                사업 전체 계획서를 등록하면 통합 보고서 상단에 자동 첨부됩니다.
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={gpTitle}
                  onChange={e => setGpTitle(e.target.value)}
                  placeholder="계획서 제목 (예: 2026년 BYCT 운영 계획서)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={triggerGpUpload}
                  disabled={gpUploading || !gpTitle.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gpUploading ? (
                    <><RefreshCw size={12} className="animate-spin" /> 업로드 중...</>
                  ) : (
                    <><Upload size={12} /> PDF 선택 후 업로드</>
                  )}
                </button>
              </div>

              {globalPlansLoading ? (
                <div className="py-6 flex justify-center">
                  <RefreshCw size={16} className="animate-spin text-gray-300" />
                </div>
              ) : globalPlans.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">등록된 전체 계획서가 없습니다</p>
              ) : (
                <div className="space-y-1.5">
                  {globalPlans.map(plan => (
                    <div key={plan.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{plan.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {formatDate(plan.created_at)} · {plan.uploaded_by}
                        </p>
                      </div>
                      <a
                        href={plan.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        <ExternalLink size={10} /> 보기
                      </a>
                      <button
                        onClick={() => handleDeleteGp(plan)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {admin.role === 'center' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>의 보고서를 자동 생성합니다.
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            Word(.docx) 다운로드, PDF 인쇄, DB 저장이 가능합니다.
          </p>
        </div>
      )}

      <ReportManager
        scope={admin.role === 'center' ? 'center' : reportScope}
        centerId={
          admin.role === 'center'
            ? (admin.center_id ?? undefined)
            : (reportScope === 'center' ? (reportCenterId ?? undefined) : undefined)
        }
        createdBy={admin.name}
        canEditOpinion={admin.role === 'center'}
        externalMarkdown={loadedReport?.markdown ?? null}
        externalMarkdownKey={loadedReport?.key ?? null}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            📚 저장된 보고서
            {!savedReportsLoading && (
              <span className="text-xs text-gray-400 font-normal">{savedReports.length}건</span>
            )}
          </h2>
          <button
            onClick={loadSavedReports}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={13} className={savedReportsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {savedReportsLoading ? (
          <div className="py-8 flex justify-center">
            <RefreshCw size={16} className="animate-spin text-gray-300" />
          </div>
        ) : savedReports.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-gray-500 font-medium">저장된 보고서가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">보고서 생성 후 'DB 저장' 버튼을 눌러보세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {savedReports.map(r => {
              const centerName = r.center_id
                ? ORGANIZATIONS.find(o => o.id === r.center_id)?.name
                : null
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.scope === 'global'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {r.scope === 'global' ? '🌐 전체' : '🏢 기관별'}
                      </span>
                      {centerName && (
                        <span className="text-[10px] font-medium text-gray-500">{centerName}</span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 mt-1 truncate">{r.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDate(r.created_at)} · {r.created_by}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleLoadSavedReport(r)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 active:scale-95 transition-all"
                    >
                      <Download size={11} /> 불러오기
                    </button>
                    <button
                      onClick={() => handleDeleteSavedReport(r)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 active:scale-95 transition-all"
                    >
                      <Trash2 size={11} /> 삭제
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
