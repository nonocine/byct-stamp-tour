'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Edit2, RefreshCw, PlusCircle, Image as ImageIcon, Upload, FileText, ExternalLink, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import { fetchAllPrograms } from '@/lib/programs'
import type { Program } from '@/lib/types'
import OrgIcon from '@/components/OrgIcon'
import ProgramEditModal from '@/components/ProgramEditModal'
import { useOrgLogos } from '@/components/OrgLogosProvider'
import type { AdminUser } from '@/components/AdminProvider'

interface Props {
  admin: AdminUser
}

export default function ProgramTab({ admin }: Props) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [creatingProgram, setCreatingProgram] = useState(false)
  const [programOrgFilter, setProgramOrgFilter] = useState<number | null>(null)

  // ── PDF 업로드 ─────────────────────────────────────────────────────────
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [pdfTargetProgramId, setPdfTargetProgramId] = useState<string | null>(null)
  const [uploadingPdfProgramId, setUploadingPdfProgramId] = useState<string | null>(null)

  // ── 로고 업로드 ────────────────────────────────────────────────────────
  const { refresh: refreshOrgLogos } = useOrgLogos()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoTargetOrgId, setLogoTargetOrgId] = useState<number | null>(null)
  const [uploadingLogoOrgId, setUploadingLogoOrgId] = useState<number | null>(null)

  async function loadPrograms() {
    setProgramsLoading(true)
    try {
      const data = await fetchAllPrograms()
      setPrograms(data)
    } finally {
      setProgramsLoading(false)
    }
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  function triggerPdfUpload(programId: string) {
    setPdfTargetProgramId(programId)
    if (pdfInputRef.current) pdfInputRef.current.value = ''
    pdfInputRef.current?.click()
  }

  async function handlePdfFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const programId = pdfTargetProgramId
    e.target.value = ''
    if (!file || !programId) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      alert('PDF 파일만 업로드 가능합니다.')
      setPdfTargetProgramId(null)
      return
    }
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      alert(`파일 크기가 너무 큽니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)\n10MB 이하의 PDF만 업로드 가능합니다.`)
      setPdfTargetProgramId(null)
      return
    }
    const program = programs.find(p => p.id === programId)
    if (!program) return
    if (admin.role === 'center' && admin.center_id !== program.organization_id) {
      alert('본인 기관 프로그램의 계획서만 업로드할 수 있습니다.')
      setPdfTargetProgramId(null)
      return
    }

    setUploadingPdfProgramId(programId)
    try {
      // program-plans 버킷은 anon 쓰기가 차단되어 있다 — 서버가 올린다.
      const form = new FormData()
      form.append('file', file)
      form.append('programId', programId)

      const res = await fetch('/api/admin/programs/plan', { method: 'POST', body: form })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'PDF 업로드에 실패했습니다.')

      const publicUrl = payload.plan_pdf_url as string
      setPrograms(prev =>
        prev.map(p => (p.id === programId ? { ...p, plan_pdf_url: publicUrl } : p)),
      )
    } catch (err: any) {
      alert(`PDF 업로드 실패: ${err?.message ?? err}`)
    } finally {
      setUploadingPdfProgramId(null)
      setPdfTargetProgramId(null)
    }
  }

  async function handleDeletePdf(program: Program) {
    if (!program.plan_pdf_url) return
    if (admin.role === 'center' && admin.center_id !== program.organization_id) {
      alert('본인 기관 프로그램의 계획서만 삭제할 수 있습니다.')
      return
    }
    if (!confirm(`"${program.title}" 의 계획서 PDF를 삭제하시겠습니까?`)) return

    setUploadingPdfProgramId(program.id)
    try {
      // Storage 파일 제거와 컬럼 비우기를 서버가 함께 처리한다.
      const res = await fetch(
        `/api/admin/programs/plan?programId=${encodeURIComponent(program.id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'PDF 삭제에 실패했습니다.')
      }

      setPrograms(prev =>
        prev.map(p => (p.id === program.id ? { ...p, plan_pdf_url: null } : p)),
      )
    } catch (err: any) {
      alert(`PDF 삭제 실패: ${err?.message ?? err}`)
    } finally {
      setUploadingPdfProgramId(null)
    }
  }

  function triggerLogoUpload(orgId: number) {
    setLogoTargetOrgId(orgId)
    if (logoInputRef.current) logoInputRef.current.value = ''
    logoInputRef.current?.click()
  }

  async function handleLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const orgId = logoTargetOrgId
    e.target.value = ''
    if (!file || !orgId) return

    setUploadingLogoOrgId(orgId)
    try {
      const rawExt = (file.name.split('.').pop() ?? 'png').toLowerCase()
      const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png'
      const path = `${orgId}-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path)
      const publicUrl = pub.publicUrl

      const { error: dbErr } = await supabase
        .from('organization_logos')
        .upsert({ center_id: orgId, logo_url: publicUrl }, { onConflict: 'center_id' })
      if (dbErr) throw dbErr

      await refreshOrgLogos()
    } catch (err: any) {
      alert(`로고 업로드 실패: ${err?.message ?? err}`)
    } finally {
      setUploadingLogoOrgId(null)
      setLogoTargetOrgId(null)
    }
  }

  return (
    <div className="px-4 space-y-4">
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoFileSelected}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handlePdfFileSelected}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {admin.role === 'center' ? (
            <>
              <h2 className="text-base font-bold text-gray-900 truncate">
                {admin.center_name ?? '본인 기관'} 프로그램 관리
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">본인 기관의 프로그램만 등록·수정할 수 있습니다.</p>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-gray-900">전체 프로그램 관리</h2>
              <p className="text-xs text-gray-500 mt-0.5">17개 기관의 모든 프로그램을 등록·수정할 수 있습니다.</p>
            </>
          )}
        </div>
        <button
          onClick={() => setCreatingProgram(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex-shrink-0"
        >
          <PlusCircle size={13} /> 신규 등록
        </button>
      </div>

      {admin.role === 'super' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600 flex-shrink-0">기관 필터</label>
          <select
            value={programOrgFilter ?? ''}
            onChange={e => setProgramOrgFilter(e.target.value === '' ? null : Number(e.target.value))}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="">전체 보기</option>
            {ORGANIZATIONS.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Edit2 size={15} /> 프로그램 목록
          </h2>
          <button onClick={loadPrograms} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={13} className={programsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {programsLoading ? (
          <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
        ) : (() => {
            const visibleOrgs = ORGANIZATIONS
              .filter(org => admin.role === 'super' || admin.center_id === org.id)
              .filter(org => admin.role !== 'super' || programOrgFilter === null || programOrgFilter === org.id)
            const totalVisible = visibleOrgs.reduce(
              (sum, org) => sum + programs.filter(p => p.organization_id === org.id).length,
              0,
            )
            if (totalVisible === 0) {
              return (
                <p className="py-10 text-center text-sm text-gray-400">
                  등록된 프로그램이 없습니다
                </p>
              )
            }
            return (
              <div className="divide-y divide-gray-100">
                {visibleOrgs.map(org => {
                  const orgPrograms = programs.filter(p => p.organization_id === org.id)
                  const editable = admin.role === 'super' || admin.center_id === org.id
                  return (
                    <div key={org.id} className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <OrgIcon org={org} size={28} rounded="rounded-lg" />
                        <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{org.name}</p>
                        {editable && (
                          <button
                            onClick={() => triggerLogoUpload(org.id)}
                            disabled={uploadingLogoOrgId === org.id}
                            className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                            title="기관 로고 변경"
                          >
                            {uploadingLogoOrgId === org.id ? (
                              <>
                                <RefreshCw size={11} className="animate-spin" />
                                업로드중
                              </>
                            ) : (
                              <>
                                <ImageIcon size={11} />
                                로고 변경
                              </>
                            )}
                          </button>
                        )}
                        <span className="text-xs text-gray-400 flex-shrink-0">{orgPrograms.length}개</span>
                      </div>

                      {orgPrograms.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 pl-9">등록된 프로그램이 없습니다</p>
                      ) : (
                        <div className="space-y-2 pl-9">
                          {orgPrograms.map(program => {
                            const pdfBusy = uploadingPdfProgramId === program.id
                            return (
                              <div key={program.id} className="bg-gray-50 rounded-xl p-3">
                                <div className="flex gap-3">
                                  {program.image_url && (
                                    <img
                                      src={program.image_url}
                                      alt={program.title}
                                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">{program.title}</p>
                                      {admin.role === 'super' && (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${org.bgColor} text-white flex-shrink-0`}>
                                          {org.shortName}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                      {program.date} · {program.time}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      정원 {program.capacity}명 · {program.target}
                                    </p>
                                  </div>
                                  {editable && (
                                    <button
                                      onClick={() => setEditingProgram(program)}
                                      className="self-start flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex-shrink-0"
                                    >
                                      <Edit2 size={11} /> 수정
                                    </button>
                                  )}
                                </div>

                                {editable && (
                                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-200">
                                    {!program.plan_pdf_url ? (
                                      <button
                                        onClick={() => triggerPdfUpload(program.id)}
                                        disabled={pdfBusy}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        {pdfBusy ? (
                                          <>
                                            <RefreshCw size={11} className="animate-spin" />
                                            업로드 중...
                                          </>
                                        ) : (
                                          <>
                                            <Upload size={11} />
                                            계획서 PDF 업로드
                                          </>
                                        )}
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => triggerPdfUpload(program.id)}
                                          disabled={pdfBusy}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {pdfBusy ? (
                                            <>
                                              <RefreshCw size={11} className="animate-spin" />
                                              처리 중...
                                            </>
                                          ) : (
                                            <>
                                              <Upload size={11} />
                                              PDF 변경
                                            </>
                                          )}
                                        </button>
                                        <a
                                          href={program.plan_pdf_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 active:scale-95 transition-all"
                                        >
                                          <FileText size={11} />
                                          PDF 보기
                                          <ExternalLink size={10} />
                                        </a>
                                        <button
                                          onClick={() => handleDeletePdf(program)}
                                          disabled={pdfBusy}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          <Trash2 size={11} />
                                          삭제
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()
        }
      </div>

      <p className="text-xs text-gray-400 text-center px-2">
        수정한 내용은 참가자 화면의 프로그램 목록에 즉시 반영됩니다.
      </p>

      {editingProgram && (
        <ProgramEditModal
          program={editingProgram}
          defaultOrgId={editingProgram.organization_id}
          onClose={() => setEditingProgram(null)}
          onSaved={updated => {
            setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
          }}
        />
      )}
      {creatingProgram && (
        <ProgramEditModal
          program={null}
          defaultOrgId={
            admin.role === 'center' && admin.center_id
              ? admin.center_id
              : (programOrgFilter ?? ORGANIZATIONS[0].id)
          }
          orgChoices={admin.role === 'super' ? ORGANIZATIONS : undefined}
          onClose={() => setCreatingProgram(false)}
          onSaved={created => {
            setPrograms(prev => [...prev, created])
          }}
        />
      )}
    </div>
  )
}
