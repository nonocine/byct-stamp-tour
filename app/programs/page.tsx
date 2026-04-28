'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Clock, Users, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react'
import OrgIcon from '@/components/OrgIcon'
import { ORGANIZATIONS, PROGRAMS } from '@/lib/data'
import { supabase } from '@/lib/supabase'

const KAKAO_APP_KEY = 'b15da2a5d31a20e1b272e534b9a24594'

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
  const [expanded, setExpanded] = useState<number | null>(null)
  const [centerUrls, setCenterUrls] = useState<Record<number, string>>({})

  const orgCardRefs  = useRef<Record<number, HTMLDivElement | null>>({})
  const mapContainer = useRef<HTMLDivElement>(null)
  const markerEls    = useRef<Record<number, HTMLDivElement>>({})
  const mapReady     = useRef(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    loadCenterUrls()
  }, [])

  async function loadCenterUrls() {
    const { data } = await supabase.from('centers').select('id, program_url')
    if (!data) return
    const map: Record<number, string> = {}
    data.forEach((c: any) => {
      if (c.program_url) map[c.id] = c.program_url
    })
    setCenterUrls(map)
  }

  // ── 카카오맵 초기화 (Script onLoad 에서 호출) ──────────────────────
  const initMap = useCallback(() => {
    if (mapReady.current || !mapContainer.current) return
    try {
      const kakao = (window as any).kakao

      const map = new kakao.maps.Map(mapContainer.current, {
        center: new kakao.maps.LatLng(35.1796, 129.0756),
        level: 8,
      })

      const geocoder = new kakao.maps.services.Geocoder()

      // 마커 생성 헬퍼
      function placeMarker(org: (typeof ORGANIZATIONS)[0], position: any) {
        const el = document.createElement('div')
        el.style.cssText = [
          'width:26px', 'height:26px',
          'background:#2563EB',
          'border:2.5px solid white',
          'border-radius:50%',
          'display:flex', 'align-items:center', 'justify-content:center',
          'color:white', 'font-size:10px', 'font-weight:900',
          'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
          'cursor:pointer',
          'transition:transform 0.15s, background-color 0.2s',
          'user-select:none',
        ].join(';')
        el.textContent = String(org.id)
        markerEls.current[org.id] = el

        const tip = document.createElement('div')
        tip.style.cssText = [
          'background:#111827', 'color:white',
          'padding:4px 10px',
          'border-radius:8px',
          'font-size:11px', 'font-weight:600',
          'white-space:nowrap',
          'pointer-events:none',
          'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
          'position:relative',
        ].join(';')
        tip.textContent = org.name

        const arrow = document.createElement('span')
        arrow.style.cssText = [
          'position:absolute', 'top:100%', 'left:50%',
          'transform:translateX(-50%)',
          'border:5px solid transparent',
          'border-top-color:#111827',
        ].join(';')
        tip.appendChild(arrow)

        const tipOverlay = new kakao.maps.CustomOverlay({
          position, content: tip, yAnchor: 2.4, xAnchor: 0.5, zIndex: 5,
        })
        new kakao.maps.CustomOverlay({
          position, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 4,
        }).setMap(map)

        el.addEventListener('click', () => {
          setExpanded(org.id)
          setTimeout(() => {
            orgCardRefs.current[org.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 80)
        })
        el.addEventListener('mouseenter', () => { tipOverlay.setMap(map); el.style.transform = 'scale(1.35)' })
        el.addEventListener('mouseleave', () => { tipOverlay.setMap(null); el.style.transform = 'scale(1)' })
      }

      // 주소 → 좌표 변환 후 마커 배치
      ORGANIZATIONS.forEach(org => {
        const address = ORG_ADDRESSES[org.id]
        if (!address) return

        geocoder.addressSearch(address, (result: any[], status: any) => {
          if (status !== kakao.maps.services.Status.OK || !result[0]) {
            console.warn(`[카카오맵] 주소 변환 실패: ${org.name} — ${address}`)
            return
          }
          const position = new kakao.maps.LatLng(
            parseFloat(result[0].y),
            parseFloat(result[0].x),
          )
          placeMarker(org, position)
        })
      })

      mapReady.current = true
    } catch (e) {
      console.error('[카카오맵] 초기화 오류:', e)
      setMapError('지도를 초기화하는 중 오류가 발생했습니다.')
    }
  }, [])

  // 카카오맵 SDK 동적 로드 — autoload=false로 document.write 회피
  useEffect(() => {
    const SCRIPT_ID = 'kakao-maps-sdk'

    function runInit() {
      const k = (window as any).kakao
      if (k && k.maps) k.maps.load(() => initMap())
    }

    // 이미 로드되어 있으면 즉시 init
    if ((window as any).kakao && (window as any).kakao.maps) {
      runInit()
      return
    }

    // 스크립트가 이미 추가되어 있으면 load 이벤트만 구독
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', runInit)
      return () => existing.removeEventListener('load', runInit)
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`
    script.async = true
    script.onload = runInit
    script.onerror = () => {
      setMapError(
        `지도를 불러오지 못했습니다. 카카오 개발자 콘솔(developers.kakao.com)에서 ` +
        `[내 애플리케이션 → 플랫폼 → Web]에 "${typeof window !== 'undefined' ? window.location.origin : ''}"을 등록해주세요.`
      )
    }
    document.head.appendChild(script)
  }, [initMap])

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`
  }

  return (
    <div className="py-5">
      {/* 헤더 */}
      <div className="px-4 mb-3">
        <h1 className="text-xl font-black text-gray-900">프로그램 목록</h1>
        <p className="text-sm text-gray-500 mt-0.5">17개 기관 · {PROGRAMS.length}개 프로그램</p>
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

                  {/* 신청 링크 */}
                  <div className="px-4 pt-3">
                    {centerUrls[org.id] ? (
                      <a
                        href={centerUrls[org.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
                      >
                        프로그램 신청하기
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <div className="w-full py-3 bg-gray-100 text-gray-400 text-sm font-medium rounded-xl text-center">
                        준비중
                      </div>
                    )}
                  </div>

                  {orgPrograms.map((program, idx) => (
                    <div key={program.id} className={`px-4 py-3.5 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
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
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
