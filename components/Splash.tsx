'use client'
import { useEffect, useState } from 'react'

interface Props {
  /** 스플래시 재생이 끝났을 때(또는 이미 본 세션이라 생략됐을 때) 호출 */
  onComplete?: () => void
}

const SESSION_KEY = 'byct_splash_shown'
const FULL_DURATION = 2900 // splashFade(2.4s 딜레이 + 0.5s) 종료 시점
const REDUCED_DURATION = 1100 // reduced-motion: 0.6s 노출 + 0.5s 페이드

export default function Splash({ onComplete }: Props) {
  // 한 세션 내에서는 다시 안 뜨도록 sessionStorage 검사 후 결정.
  // SSR 에서는 false, 클라이언트 hydration 시 lazy init 으로 실제 값 확정.
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem(SESSION_KEY)
  })

  useEffect(() => {
    document.body.style.visibility = 'visible'
    if (!showSplash) {
      onComplete?.()
      return
    }

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = prefersReduced ? REDUCED_DURATION : FULL_DURATION

    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1')
      setShowSplash(false)
      onComplete?.()
    }, duration)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showSplash) return null

  return (
    <div className="byct-splash" aria-hidden>
      <div className="byct-stage">
        {/* 1. 점선 가이드 원 */}
        <div className="byct-guide" />
        {/* 2. 잉크 번짐 링 */}
        <div className="byct-ink" />
        {/* 3. 잉크 튀김 파티클 */}
        <span className="byct-splat byct-splat-1" />
        <span className="byct-splat byct-splat-2" />
        <span className="byct-splat byct-splat-3" />
        <span className="byct-splat byct-splat-4" />
        <span className="byct-splat byct-splat-5" />
        <span className="byct-splat byct-splat-6" />
        {/* 4. 도장 본체 */}
        <div className="byct-stamp">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="94" fill="#16a34a" />
            <circle cx="100" cy="100" r="94" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="100" cy="100" r="82" fill="none" stroke="#fff" strokeWidth="1.5" />
            <path id="byct-top" d="M 34 100 A 66 66 0 0 1 166 100" fill="none" />
            <text fill="#fff" fontSize="11" fontWeight="700" letterSpacing="1.2">
              <textPath href="#byct-top" startOffset="50%" textAnchor="middle">
                부산광역시청소년수련시설협회
              </textPath>
            </text>
            <path id="byct-bot" d="M 40 110 A 60 60 0 0 0 160 110" fill="none" />
            <text fill="#fff" fontSize="10" fontWeight="600" letterSpacing="2.5">
              <textPath href="#byct-bot" startOffset="50%" textAnchor="middle">
                ★ 2026 BUSAN ★
              </textPath>
            </text>
            <rect x="86" y="62" width="5" height="20" rx="1" fill="#1d4ed8" />
            <rect x="93" y="62" width="5" height="20" rx="1" fill="#facc15" />
            <rect x="100" y="62" width="5" height="20" rx="1" fill="#fff" />
            <text x="100" y="112" fill="#fff" fontSize="30" fontWeight="800" textAnchor="middle" letterSpacing="1">
              B.Y.C.T
            </text>
            <text x="100" y="132" fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="3">
              STAMP TOUR
            </text>
          </svg>
        </div>
      </div>

      {/* 5. 하단 문구 */}
      <p className="byct-tagline">17개 기관, 하나의 도전</p>

      <style jsx global>{`
        .byct-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #fdf6e8;
          pointer-events: none;
          animation: byct-splashFade 0.5s ease-in 2.4s forwards;
        }

        .byct-stage {
          position: relative;
          width: 250px;
          height: 250px;
        }

        /* 1. 점선 가이드 원 */
        .byct-guide {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 212px;
          height: 212px;
          margin: -106px 0 0 -106px;
          border: 2px dashed rgba(22, 163, 74, 0.28);
          border-radius: 50%;
          opacity: 0;
          animation: byct-guideIn 0.4s ease-out 0.1s forwards;
        }

        /* 2. 잉크 번짐 링 */
        .byct-ink {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 188px;
          height: 188px;
          margin: -94px 0 0 -94px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(22, 163, 74, 0.4) 0%, transparent 70%);
          opacity: 0;
          animation: byct-inkSpread 0.5s ease-out 0.62s forwards;
        }

        /* 3. 잉크 튀김 파티클 */
        .byct-splat {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          background: #16a34a;
          opacity: 0;
        }
        .byct-splat-1 {
          width: 9px;
          height: 9px;
          animation: byct-splat1 0.52s ease-out 0.64s forwards;
        }
        .byct-splat-2 {
          width: 7px;
          height: 7px;
          animation: byct-splat2 0.5s ease-out 0.64s forwards;
        }
        .byct-splat-3 {
          width: 11px;
          height: 11px;
          animation: byct-splat3 0.54s ease-out 0.64s forwards;
        }
        .byct-splat-4 {
          width: 6px;
          height: 6px;
          animation: byct-splat4 0.5s ease-out 0.64s forwards;
        }
        .byct-splat-5 {
          width: 8px;
          height: 8px;
          animation: byct-splat5 0.55s ease-out 0.64s forwards;
        }
        .byct-splat-6 {
          width: 12px;
          height: 12px;
          animation: byct-splat6 0.53s ease-out 0.64s forwards;
        }

        /* 4. 도장 본체 (188x188) — stampDrop + stampSettle 둘 다 적용 */
        .byct-stamp {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 188px;
          height: 188px;
          margin: -94px 0 0 -94px;
          opacity: 0;
          animation:
            byct-stampDrop 0.55s cubic-bezier(0.55, 0.08, 0.68, 0.53) 0.15s forwards,
            byct-stampSettle 1s ease-out 0.7s forwards;
        }
        .byct-stamp svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* 5. 하단 문구 */
        .byct-tagline {
          margin-top: 24px;
          color: #15803d;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.5px;
          opacity: 0;
          animation: byct-taglineIn 0.5s ease-out 1.1s forwards;
        }

        @keyframes byct-guideIn {
          from {
            opacity: 0;
            transform: scale(0.7);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes byct-inkSpread {
          0% {
            opacity: 0.9;
            transform: scale(0.3);
          }
          100% {
            opacity: 0;
            transform: scale(1.9);
          }
        }

        @keyframes byct-stampDrop {
          0% {
            transform: translateY(-300px) scale(2.1) rotate(-26deg);
            opacity: 0;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(0.9) rotate(-7deg);
            opacity: 1;
          }
        }

        @keyframes byct-stampSettle {
          0% {
            transform: translateY(0) scale(0.9) rotate(-7deg);
          }
          25% {
            transform: translateY(0) scale(1.06) rotate(-5deg);
          }
          45% {
            transform: translateY(0) scale(0.98) rotate(-6.5deg);
          }
          65% {
            transform: translateY(0) scale(1.02) rotate(-5.5deg);
          }
          100% {
            transform: translateY(0) scale(1) rotate(-6deg);
          }
        }

        @keyframes byct-taglineIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes byct-splashFade {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
            visibility: hidden;
          }
        }

        /* 잉크 튀김 6방향 */
        @keyframes byct-splat1 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 110px), calc(-50% - 62px)) scale(0.5);
          }
        }
        @keyframes byct-splat2 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 100px), calc(-50% - 80px)) scale(0.5);
          }
        }
        @keyframes byct-splat3 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 120px), calc(-50% + 52px)) scale(0.5);
          }
        }
        @keyframes byct-splat4 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 90px), calc(-50% + 86px)) scale(0.5);
          }
        }
        @keyframes byct-splat5 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% - 128px), calc(-50% + 14px)) scale(0.5);
          }
        }
        @keyframes byct-splat6 {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + 82px), calc(-50% + 108px)) scale(0.5);
          }
        }

        /* 접근성 — 모션 최소화 설정 시 낙하/튀김/흔들림 생략 */
        @media (prefers-reduced-motion: reduce) {
          .byct-guide,
          .byct-ink,
          .byct-splat,
          .byct-stamp,
          .byct-tagline {
            animation: none !important;
          }
          .byct-guide,
          .byct-stamp,
          .byct-tagline {
            opacity: 1 !important;
          }
          .byct-ink,
          .byct-splat {
            opacity: 0 !important;
          }
          .byct-stamp {
            transform: rotate(-6deg) !important;
          }
          .byct-splash {
            animation: byct-splashFade 0.5s ease-in 0.6s forwards !important;
          }
        }
      `}</style>
    </div>
  )
}
