'use client'
import { useState, useEffect, useRef } from 'react'
import { MapPin, Clock, Users, ChevronDown, ChevronUp, Stamp } from 'lucide-react'
import RatingModal from '@/components/RatingModal'
import OrgIcon from '@/components/OrgIcon'
import { ORGANIZATIONS, PROGRAMS } from '@/lib/data'
import { loadParticipant, loadStamps, saveStamp } from '@/lib/store'
import type { Participant, Stamp as StampType, Program, Organization } from '@/lib/types'
import Link from 'next/link'

const KAKAO_APP_KEY = 'b15da2a5d31a20e1b272e534b9a24594'

const ORG_COORDS: Record<number, { lat: number; lng: number }> = {
  1:  { lat: 35.1631, lng: 129.1603 },
  2:  { lat: 35.1571, lng: 129.0572 },
  3:  { lat: 35.1588, lng: 129.1420 },
  4:  { lat: 35.2107, lng: 129.0156 },
  5:  { lat: 35.1977, lng: 129.0836 },
  6:  { lat: 35.1454, lng: 129.1134 },
  7:  { lat: 35.1721, lng: 129.1089 },
  8:  { lat: 35.0996, lng: 128.9757 },
  9:  { lat: 35.1579, lng: 129.0471 },
  10: { lat: 35.2041, lng: 128.9891 },
  11: { lat: 35.1537, lng: 128.9924 },
  12: { lat: 35.1555, lng: 129.0601 },
  13: { lat: 35.1602, lng: 129.0231 },
  14: { lat: 35.0979, lng: 129.0197 },
  15: { lat: 35.1479, lng: 129.1156 },
  16: { lat: 35.1523, lng: 129.1398 },
  17: { lat: 35.2423, lng: 129.0894 },
}

export default function ProgramsPage() {
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [stamps, setStamps] = useState<StampType[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [modalData, setModalData] = useState<{ program: Program; org: Organization } | null>(null)

  const orgCardRefs  = useRef<Record<number, HTMLDivElement | null>>({})
  const mapContainer = useRef<HTMLDivElement>(null)
  const markerEls    = useRef<Record<number, HTMLDivElement>>({})
  const mapReady     = useRef(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    setParticipant(loadParticipant())
    setStamps(loadStamps())
  }, [])

  // ── 카카오맵 초기화 ──────────────────────────────────────────────
  useEffect(() => {
    if (mapReady.current) return

    function initMap() {
      try {
        if (!mapContainer.current) {
          console.error('[카카오맵] 지도 컨테이너 DOM을 찾을 수 없습니다.')
          return
        }
        const kakao = (window as any).kakao

      const map = new kakao.maps.Map(mapContainer.current, {
        center: new kakao.maps.LatLng(35.1796, 129.0756),
        level: 8,
      })

      ORGANIZATIONS.forEach(org => {
        const coords = ORG_COORDS[org.id]
        if (!coords) return
        const position = new kakao.maps.LatLng(coords.lat, coords.lng)

        // 마커 DOM 엘리먼트
        const el = document.createElement('div')
        el.style.cssText = [
          'width:26px','height:26px',
          'background:#2563EB',
          'border:2.5px solid white',
          'border-radius:50%',
          'display:flex','align-items:center','justify-content:center',
          'color:white','font-size:10px','font-weight:900',
          'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
          'cursor:pointer',
          'transition:transform 0.15s, background-color 0.2s',
          'user-select:none',
        ].join(';')
        el.textContent = String(org.id)
        markerEls.current[org.id] = el

        // 툴팁 DOM 엘리먼트
        const tip = document.createElement('div')
        tip.style.cssText = [
          'background:#111827','color:white',
          'padding:4px 10px',
          'border-radius:8px',
          'font-size:11px','font-weight:600',
          'white-space:nowrap',
          'pointer-events:none',
          'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
          'position:relative',
        ].join(';')
        tip.textContent = org.name

        const arrow = document.createElement('span')
        arrow.style.cssText = [
          'position:absolute','top:100%','left:50%',
          'transform:translateX(-50%)',
          'border:5px solid transparent',
          'border-top-color:#111827',
        ].join(';')
        tip.appendChild(arrow)

        const tipOverlay = new kakao.maps.CustomOverlay({
          position, content: tip, yAnchor: 2.4, xAnchor: 0.5, zIndex: 5,
        })

        // 마커 오버레이
        new kakao.maps.CustomOverlay({
          position, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 4,
        }).setMap(map)

        el.addEventListener('click', () => {
          setExpanded(org.id)
          setTimeout(() => {
            orgCardRefs.current[org.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 80)
        })
        el.addEventListener('mouseenter', () => {
          tipOverlay.setMap(map)
          el.style.transform = 'scale(1.35)'
        })
        el.addEventListener('mouseleave', () => {
          tipOverlay.setMap(null)
          el.style.transform = 'scale(1)'
        })
      })

        mapReady.current = true
        console.log('[카카오맵] 초기화 완료')
      } catch (e) {
        console.error('[카카오맵] 초기화 오류:', e)
        setMapError('지도를 초기화하는 중 오류가 발생했습니다.')
      }
    }

    // 이미 로드된 SDK 재사용
    if ((window as any).kakao?.maps) {
      ;(window as any).kakao.maps.load(initMap)
      return
    }

    // 중복 script 삽입 방지
    if (document.getElementById('kakao-map-sdk')) return

    const script = document.createElement('script')
    script.id  = 'kakao-map-sdk'
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`
    script.onload = () => {
      console.log('[카카오맵] SDK 로드 성공, appkey:', KAKAO_APP_KEY)
      ;(window as any).kakao.maps.load(initMap)
    }
    script.onerror = () => {
      console.error('[카카오맵] SDK 로드 실패 ― 아래 사항을 확인하세요:')
      console.error('  1) 카카오 개발자 콘솔 > 플랫폼 > Web에 현재 도메인 등록 여부')
      console.error('  2) 현재 도메인:', window.location.origin)
      console.error('  3) appkey:', KAKAO_APP_KEY)
      setMapError(`지도를 불러오지 못했습니다. 카카오 개발자 콘솔(developers.kakao.com)에서 [Web 플랫폼] 도메인에 "${window.location.origin}"을 등록해주세요.`)
    }
    document.head.appendChild(script)
  }, [])

  // ── 스탬프 수집 시 마커 색상 업데이트 ────────────────────────────
  useEffect(() => {
    const stamped = new Set(stamps.map(s => s.organization_id))
    Object.entries(markerEls.current).forEach(([idStr, el]) => {
      const id = Number(idStr)
      const done = stamped.has(id)
      el.style.backgroundColor = done ? '#22C55E' : '#2563EB'
      el.textContent = done ? '✓' : String(id)
    })
  }, [stamps])

  function handleRatingSubmit(rating: number, review: string) {
    if (!modalData || !participant) return
    const newStamp: StampType = {
      id: crypto.randomUUID(),
      participant_id: participant.id,
      program_id: modalData.program.id,
      organization_id: modalData.org.id,
      rating,
      review,
      program_name: modalData.program.name,
      created_at: new Date().toISOString(),
    }
    saveStamp(newStamp)
    setStamps(loadStamps())
    setModalData(null)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`
  }

  const stampedOrgIds = new Set(stamps.map(s => s.organization_id))

  return (
    <div className="py-5">
      {/* 헤더 */}
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900">프로그램 목록</h1>
            <p className="text-sm text-gray-500 mt-0.5">17개 기관 · {PROGRAMS.length}개 프로그램</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-blue-600">
              {stamps.length}<span className="text-sm font-normal text-gray-400">/17</span>
            </p>
            <p className="text-xs text-gray-500">수집한 스탬프</p>
          </div>
        </div>
      </div>

      {/* 참가자 미등록 알림 */}
      {!participant && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
          <p className="text-xs text-amber-800 font-medium">스탬프를 받으려면 먼저 등록해주세요</p>
          <Link href="/register" className="text-xs text-amber-700 font-bold underline">등록하기</Link>
        </div>
      )}

      {/* ── 카카오맵 ── */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden shadow-sm border border-gray-200 h-[300px] relative">
        {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
            <span className="text-2xl">🗺️</span>
            <p className="text-sm font-semibold text-gray-700">지도 로드 실패</p>
            <p className="text-xs text-gray-500 leading-relaxed">{mapError}</p>
          </div>
        ) : (
          <div ref={mapContainer} className="w-full h-full" />
        )}
      </div>

      {/* 기관 목록 */}
      <div className="px-4 space-y-3">
        {ORGANIZATIONS.map(org => {
          const orgPrograms = PROGRAMS.filter(p => p.organization_id === org.id)
          const isExpanded  = expanded === org.id
          const hasStamp    = stampedOrgIds.has(org.id)

          return (
            <div
              key={org.id}
              ref={el => { orgCardRefs.current[org.id] = el }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-16"
            >
              {/* 기관 헤더 */}
              <button
                onClick={() => setExpanded(isExpanded ? null : org.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <OrgIcon org={org} size={44} rounded="rounded-xl" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{org.name}</p>
                    {hasStamp && (
                      <span className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        ✓ 완료
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{org.category} · {orgPrograms.length}개 프로그램</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasStamp ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: org.color }}>
                      <Stamp size={14} color="white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <Stamp size={14} className="text-gray-300" />
                    </div>
                  )}
                  {isExpanded
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* 기관 소개 + 프로그램 */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  <div className="px-4 py-3 bg-gray-50">
                    <p className="text-xs text-gray-600">{org.description}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <MapPin size={11} className="text-gray-400" />
                      <p className="text-xs text-gray-400">{org.location}</p>
                    </div>
                  </div>

                  {orgPrograms.map((program, idx) => (
                    <div key={program.id} className={`px-4 py-3.5 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{program.name}</p>
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
                        </div>

                        {participant && (
                          <div className="flex-shrink-0">
                            {hasStamp ? (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: org.color }}
                              >
                                ✓
                              </div>
                            ) : (
                              <button
                                onClick={() => setModalData({ program, org })}
                                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white text-xs font-semibold transition-all active:scale-95"
                                style={{ backgroundColor: org.color }}
                              >
                                <Stamp size={16} />
                                체험완료
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 별점 모달 */}
      {modalData && (
        <RatingModal
          program={modalData.program}
          organization={modalData.org}
          onClose={() => setModalData(null)}
          onSubmit={handleRatingSubmit}
        />
      )}
    </div>
  )
}
