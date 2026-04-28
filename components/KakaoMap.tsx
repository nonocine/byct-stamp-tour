'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

const KAKAO_APP_KEY = 'b15da2a5d31a20e1b272e534b9a24594'
const SCRIPT_ID = 'kakao-maps-sdk'

export interface KakaoMapOrg {
  id: number
  name: string
  address: string
  color?: string
}

interface Props {
  organizations: KakaoMapOrg[]
  onMarkerClick?: (orgId: number) => void
}

export default function KakaoMap({ organizations, onMarkerClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function init() {
      if (!mapRef.current || initialized.current) return
      try {
        const kakao = window.kakao
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(35.1796, 129.0756),
          level: 8,
        })

        const geocoder = new kakao.maps.services.Geocoder()

        function placeMarker(org: KakaoMapOrg, position: any) {
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

          el.addEventListener('click', () => onMarkerClick?.(org.id))
          el.addEventListener('mouseenter', () => { tipOverlay.setMap(map); el.style.transform = 'scale(1.35)' })
          el.addEventListener('mouseleave', () => { tipOverlay.setMap(null); el.style.transform = 'scale(1)' })
        }

        organizations.forEach(org => {
          if (!org.address) return
          geocoder.addressSearch(org.address, (result: any[], status: any) => {
            if (status !== kakao.maps.services.Status.OK || !result[0]) {
              console.warn(`[카카오맵] 주소 변환 실패: ${org.name} — ${org.address}`)
              return
            }
            const position = new kakao.maps.LatLng(
              parseFloat(result[0].y),
              parseFloat(result[0].x),
            )
            placeMarker(org, position)
          })
        })

        initialized.current = true
      } catch (e) {
        console.error('[카카오맵] 초기화 오류:', e)
        setError('지도를 초기화하는 중 오류가 발생했습니다.')
      }
    }

    function loadAndInit() {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(init)
        return
      }
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => window.kakao.maps.load(init))
        return
      }
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`
      script.async = true
      script.onload = () => window.kakao.maps.load(init)
      script.onerror = () => {
        setError(
          `지도를 불러오지 못했습니다. 카카오 개발자 콘솔에서 ` +
          `[내 애플리케이션 → 플랫폼 → Web]에 "${typeof window !== 'undefined' ? window.location.origin : ''}"을 등록해주세요.`
        )
      }
      document.head.appendChild(script)
    }

    loadAndInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
        <span className="text-2xl">🗺️</span>
        <p className="text-sm font-semibold text-gray-700">지도 로드 실패</p>
        <p className="text-xs text-gray-500 leading-relaxed">{error}</p>
      </div>
    )
  }

  return <div ref={mapRef} className="w-full h-full" />
}
