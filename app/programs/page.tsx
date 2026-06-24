'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Clock, Users, ChevronDown, ChevronUp, ExternalLink, Info, Check } from 'lucide-react'
import OrgIcon from '@/components/OrgIcon'
import { ORGANIZATIONS } from '@/lib/data'
import { fetchAllPrograms } from '@/lib/programs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import type { KakaoMapOrg } from '@/components/KakaoMap'
import type { Program } from '@/lib/types'

const KakaoMap = dynamic(() => import('@/components/KakaoMap'), { ssr: false })

type AppStatus = 'pending' | 'approved' | 'rejected' | 'waiting'

const ORG_ADDRESSES: Record<number, string> = {
  1:  '부산광역시 해운대구 재반로 151-21',
  2:  '부산광역시 부산진구 동평로405번길 85',
  3:  '부산광역시 해운대구 반송순환로 135',
  4:  '부산광역시 북구 효열로 158',
  5:  '부산광역시 동래구 문화로 90',
  6:  '부산광역시 수영구 수영로521번길 77',
  7:  '부산광역시 수영구 황령산로 156',
  8:  '부산광역시 사하구 다대로 716-1',
  9:  '부산광역시 부산진구 범전로5번길 13',
  10: '부산광역시 북구 화봉로 80',
  11: '부산광역시 사상구 학감대로 118',
  12: '부산광역시 부산진구 진남로328번길 62',
  13: '부산광역시 부산진구 가야대로548번길 50',
  14: '부산광역시 중구 보수동2가 65-5',
  15: '부산광역시 남구 황령대로 401-9',
  16: '부산광역시 해운대구 해운대해변로 35',
  17: '부산광역시 금정구 기찰로96번길 47',
}

export default function ProgramsPage() {
  const { profile } = useAuth()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [centerUrls, setCenterUrls] = useState<Record<number, string>>({})
  const [appStatusByCenter, setAppStatusByCenter] = useState<Record<number, AppStatus>>({})
  // 기관별로 어떤 프로그램으로 신청했는지 (program_id) — 같은 기관 다른 프로그램 중복 신청 차단용
  const [appProgramByCenter, setAppProgramByCenter] = useState<Record<number, string | null>>({})
  const [stampedCenters, setStampedCenters] = useState<Set<number>>(new Set())
  const [submittingProgramId, setSubmittingProgramId] = useState<string | null>(null)
  const [dupNotice, setDupNotice] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])

  const orgCardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    loadCenterUrls()
    loadPrograms()
  }, [])

  // ?center={id} 쿼리 진입 시 해당 기관 자동 펼치기 + 스크롤
  // (정적 prerender 호환을 위해 useSearchParams 대신 window.location.search 사용)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('center')
    if (!raw) return
    const centerId = Number(raw)
    if (!Number.isInteger(centerId)) return
    if (!ORGANIZATIONS.some(o => o.id === centerId)) return
    setExpanded(centerId)
    // 카드 DOM이 펼쳐진 후 스크롤
    setTimeout(() => {
      orgCardRefs.current[centerId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  async function loadPrograms() {
    const data = await fetchAllPrograms()
    setPrograms(data)
  }

  useEffect(() => {
    if (profile) {
      loadApplications()
      loadStamps()
    } else {
      setAppStatusByCenter({})
      setAppProgramByCenter({})
      setStampedCenters(new Set())
    }
  }, [profile])

  async function loadCenterUrls() {
    const { data } = await supabase.from('centers').select('id, program_url')
    if (!data) return
    const map: Record<number, string> = {}
    data.forEach((c: any) => {
      if (c.program_url) map[c.id] = c.program_url
    })
    setCenterUrls(map)
  }

  async function loadApplications() {
    if (!profile) return
    const { data } = await supabase
      .from('applications')
      .select('center_id, status, program_id')
      .eq('participant_id', profile.id)
    const statusMap: Record<number, AppStatus> = {}
    const progMap: Record<number, string | null> = {}
    ;(data ?? []).forEach((r: any) => {
      if (r.center_id != null && r.status) {
        statusMap[r.center_id] = r.status as AppStatus
        progMap[r.center_id] = r.program_id ?? null
      }
    })
    setAppStatusByCenter(statusMap)
    setAppProgramByCenter(progMap)
  }

  async function loadStamps() {
    if (!profile) return
    const { data } = await supabase
      .from('stamp_records')
      .select('center_id')
      .eq('participant_id', profile.id)
    setStampedCenters(
      new Set(
        (data ?? [])
          .map((r: any) => r.center_id)
          .filter((id: any): id is number => typeof id === 'number'),
      ),
    )
  }

  // 같은 기관에 이미(거절 제외) 신청한 다른 프로그램이 있으면 true
  function isBlockedByOtherProgram(orgId: number, programId: string) {
    const status = appStatusByCenter[orgId]
    if (!status || status === 'rejected') return false
    return appProgramByCenter[orgId] !== programId
  }

  async function handleApplyComplete(org: { id: number; name: string }, program: Program) {
    const orgId = org.id
    console.log('[신청 완료] 호출됨, orgId =', orgId, 'programId =', program.id)

    if (!profile) {
      console.warn('[신청 완료] 로그인 정보 없음 — profile is null')
      alert('로그인 후 이용해주세요.')
      return
    }
    console.log('[신청 완료] 로그인 사용자 profile:', {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
    })

    // 같은 기관 다른 프로그램 중복 신청 차단
    if (isBlockedByOtherProgram(orgId, program.id)) {
      console.log('[신청 완료] 같은 기관 다른 프로그램 이미 신청 — 중복 안내')
      setDupNotice(true)
      return
    }

    const currentStatus = appStatusByCenter[orgId]
    if (currentStatus && currentStatus !== 'rejected') {
      console.log('[신청 완료] 이미 신청한 프로그램, 무시 — 상태:', currentStatus)
      return
    }

    const payload = {
      participant_id: profile.id,
      participant_name: profile.name,
      participant_phone: profile.phone,
      center_id: orgId,
      center_name: org.name,
      program_id: program.id,
      program_title: program.title,
      status: 'pending',
    }

    // 필수 필드 누락 사전 검증
    const missing = (Object.entries(payload) as [string, any][])
      .filter(([k, v]) => k !== 'status' && (v === undefined || v === null || v === ''))
      .map(([k]) => k)
    if (missing.length > 0) {
      console.error('[신청 완료] 필수 필드 누락:', missing, payload)
      alert(`필수 정보가 누락되어 저장할 수 없습니다: ${missing.join(', ')}`)
      return
    }

    console.log(
      '[신청 완료] supabase.from("applications").upsert(payload, { onConflict: "participant_id,center_id" })',
    )
    console.log('[신청 완료] payload =', payload)

    setSubmittingProgramId(program.id)
    try {
      // 1. applications 테이블 존재 여부 사전 확인 (table not found 식별용)
      const probe = await supabase.from('applications').select('id').limit(1)
      if (probe.error) {
        console.error('[신청 완료] applications 테이블 접근 실패:', probe.error)
        // 테이블이 없으면 PGRST205 ("relation ... does not exist")
        if ((probe.error as any).code === 'PGRST205' || (probe.error.message ?? '').includes('does not exist')) {
          alert(
            'Supabase에 applications 테이블이 없습니다.\n' +
              'supabase/schema.sql 의 applications 테이블 / 정책을 SQL Editor 에서 실행해주세요.',
          )
          return
        }
      }

      const { data, error } = await supabase
        .from('applications')
        .upsert(payload, { onConflict: 'participant_id,center_id' })
        .select()

      if (error) {
        console.error('[신청 완료] upsert 오류 — full error object:', error)
        console.error('[신청 완료] error.message:', error.message)
        console.error('[신청 완료] error.code   :', (error as any).code)
        console.error('[신청 완료] error.details:', (error as any).details)
        console.error('[신청 완료] error.hint   :', (error as any).hint)
        throw error
      }

      console.log('[신청 완료] 저장 성공, 응답 데이터:', data)
      setAppStatusByCenter(prev => ({ ...prev, [orgId]: 'pending' }))
      setAppProgramByCenter(prev => ({ ...prev, [orgId]: program.id }))
    } catch (e: any) {
      const rawMsg = e?.message ?? ''
      const msg = rawMsg.toLowerCase()
      console.error('[신청 완료] catch — exception:', e)

      let userMsg = '신청 완료 등록에 실패했습니다. 다시 시도해주세요.'
      if (msg.includes('failed to fetch') || msg.includes('network')) {
        userMsg = '네트워크 오류가 발생했습니다.'
      } else if ((e as any)?.code === 'PGRST205' || msg.includes('does not exist')) {
        userMsg = 'applications 테이블이 없습니다. 관리자에게 문의해주세요.'
      } else if ((e as any)?.code === '23503') {
        userMsg = '참가자 정보를 찾을 수 없습니다. 다시 로그인 해주세요.'
      } else if (rawMsg) {
        // 개발 단계 — 실제 메시지를 보여주면 디버깅이 쉬워짐
        userMsg = `신청 완료 등록 실패: ${rawMsg}`
      }
      alert(userMsg)
    } finally {
      setSubmittingProgramId(null)
    }
  }

  function handleMarkerClick(orgId: number) {
    setExpanded(orgId)
    setTimeout(() => {
      orgCardRefs.current[orgId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const mapOrgs: KakaoMapOrg[] = ORGANIZATIONS.map(o => ({
    id: o.id,
    name: o.name,
    address: ORG_ADDRESSES[o.id] ?? '',
  }))

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`
  }

  return (
    <div className="py-5">
      {/* 헤더 */}
      <div className="px-4 mb-3">
        <h1 className="text-xl font-black text-gray-900">프로그램 목록</h1>
        <p className="text-sm text-gray-500 mt-0.5">17개 기관</p>
      </div>

      {/* 안내 */}
      <div className="mx-4 mb-4 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          스탬프는 기관 방문 후 담당자가 인증해 드립니다.
        </p>
      </div>

      {/* 카카오맵 */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden shadow-sm border border-gray-200 h-[300px] relative">
        <KakaoMap organizations={mapOrgs} onMarkerClick={handleMarkerClick} />
      </div>

      {/* 기관 목록 */}
      <div className="px-4 space-y-3">
        {ORGANIZATIONS.map(org => {
          const orgPrograms = programs.filter(p => p.organization_id === org.id)
          const isExpanded  = expanded === org.id

          return (
            <div
              key={org.id}
              ref={el => { orgCardRefs.current[org.id] = el }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-16"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : org.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <OrgIcon org={org} size={44} rounded="rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{org.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{org.category} · {orgPrograms.length}개 프로그램</p>
                </div>
                <div className="flex-shrink-0">
                  {isExpanded
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100">
                  <div className="px-4 py-3 bg-gray-50">
                    <p className="text-xs text-gray-600">{org.description}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <MapPin size={11} className="text-gray-400" />
                      <p className="text-xs text-gray-400">{org.location}</p>
                    </div>
                  </div>

                  {orgPrograms.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      등록된 프로그램이 없습니다.
                    </div>
                  )}

                  {orgPrograms.map((program, idx) => (
                    <div key={program.id} className={`px-4 py-3.5 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                      {program.image_url && (
                        <img
                          src={program.image_url}
                          alt={program.title}
                          className="w-full aspect-video object-cover rounded-xl mb-2 border border-gray-100"
                          loading="lazy"
                        />
                      )}
                      <p className="text-sm font-semibold text-gray-900">{program.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{program.description}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={11} className="text-gray-400" />
                          {formatDate(program.date)} · {program.time}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users size={11} className="text-gray-400" />
                          정원 {program.capacity}명
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} className="text-gray-400" />
                          {program.location}
                        </span>
                      </div>
                      <span className="inline-block mt-2 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {program.target}
                      </span>

                      {/* 프로그램별 신청 영역 */}
                      {(() => {
                        const status = appStatusByCenter[org.id]
                        const appliedHere =
                          !!status && status !== 'rejected' && appProgramByCenter[org.id] === program.id
                        const blocked = isBlockedByOtherProgram(org.id, program.id)
                        const submitting = submittingProgramId === program.id
                        const link = program.application_url || centerUrls[org.id] || null

                        // 이 프로그램으로 신청 완료된 경우 — 상태만 표시
                        if (appliedHere) {
                          if (status === 'pending') {
                            return (
                              <div className="mt-3 w-full flex items-center justify-center py-2.5 bg-amber-50 text-amber-700 text-sm font-bold rounded-xl border border-amber-200">
                                ⏳ 승인 대기중
                              </div>
                            )
                          }
                          if (status === 'waiting') {
                            return (
                              <div className="mt-3 w-full flex items-center justify-center py-2.5 bg-orange-50 text-orange-700 text-sm font-bold rounded-xl border border-orange-200">
                                📋 대기열 등록
                              </div>
                            )
                          }
                          // approved
                          const hasStamp = stampedCenters.has(org.id)
                          return (
                            <div className="mt-3 w-full flex flex-col items-center justify-center py-2 bg-green-50 text-green-700 text-sm font-bold rounded-xl border border-green-200 leading-tight">
                              <span>✅ 승인 완료</span>
                              <span className="text-[10px] font-medium mt-0.5">
                                {hasStamp ? '스탬프 발급됨' : '활동 후 스탬프 발급 예정'}
                              </span>
                            </div>
                          )
                        }

                        // 신청 버튼 (① 외부 신청 링크 + ② 신청 완료)
                        return (
                          <div className="mt-3 flex gap-2">
                            {link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => {
                                  if (blocked) {
                                    e.preventDefault()
                                    setDupNotice(true)
                                  }
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
                              >
                                ① 신청하기
                                <ExternalLink size={14} />
                              </a>
                            ) : (
                              <div className="flex-1 py-2.5 bg-gray-100 text-gray-400 text-sm font-medium rounded-xl text-center">
                                준비중
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleApplyComplete(org, program)}
                              disabled={submitting || !profile}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!profile ? '로그인이 필요합니다' : ''}
                            >
                              {submitting ? '저장 중...' : status === 'rejected' ? '② 재신청' : '② 신청 완료'}
                              {!submitting && <Check size={14} />}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 같은 기관 중복 신청 안내 팝업 */}
      {dupNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDupNotice(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xs p-5 text-center shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-3xl mb-2">⚠️</p>
            <p className="text-sm font-bold text-gray-900 mb-1.5">이미 신청한 기관입니다</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              이미 이 기관에 신청한 프로그램이 있습니다. 한 기관에서는 스탬프를 1개만 획득할 수 있습니다.
            </p>
            <button
              onClick={() => setDupNotice(false)}
              className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
