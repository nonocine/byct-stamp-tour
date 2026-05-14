'use client'
import { useEffect, useState } from 'react'

const SESSION_KEY = 'byct_splash_shown'
const FULL_DURATION = 2000
const REDUCED_DURATION = 500
const FADE_DURATION = 300

export default function Splash() {
  // 한 세션 내에서는 다시 안 뜨도록 sessionStorage 검사 후 결정.
  // SSR 에서는 false 로 시작하고, 클라이언트 hydration 시 lazy init 으로 실제 값 확정.
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem(SESSION_KEY)
  })
  const [fadingOut, setFadingOut] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    document.body.style.visibility = 'visible'
    if (!showSplash) return

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReducedMotion(prefersReduced)

    const totalDuration = prefersReduced ? REDUCED_DURATION : FULL_DURATION
    const fadeStart = Math.max(0, totalDuration - FADE_DURATION)

    const fadeT = setTimeout(() => setFadingOut(true), fadeStart)
    const doneT = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1')
      setShowSplash(false)
    }, totalDuration)

    return () => {
      clearTimeout(fadeT)
      clearTimeout(doneT)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showSplash) return null

  const stampAnimation = reducedMotion ? 'none' : 'byct-stamp-drop 1700ms forwards'
  const inkAnimation = reducedMotion ? 'none' : 'byct-ink-spread 1700ms ease-out forwards'
  const containerAnimation = fadingOut
    ? `byct-splash-fadeout ${FADE_DURATION}ms ease-out forwards`
    : undefined

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: '#FFF8EC',
        animation: containerAnimation,
      }}
    >
      {/* 점선 원형 가이드 — 스탬프가 찍힐 자리 암시 */}
      <div
        aria-hidden
        className="absolute rounded-full border-2 border-dashed border-gray-300/70"
        style={{ width: 320, height: 320 }}
      />

      {/* 잉크 번짐 — 로고 뒤에 깔리는 radial-gradient */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          background: 'radial-gradient(circle, rgba(26,58,140,0.18) 0%, rgba(26,58,140,0.08) 45%, transparent 70%)',
          opacity: reducedMotion ? 0 : 0,
          animation: inkAnimation,
        }}
      />

      {/* 로고 */}
      <img
        src="/association-logo.png"
        alt="B.Y.C.T 스탬프투어"
        width={280}
        height={280}
        className="relative object-contain"
        style={{
          width: 280,
          height: 280,
          animation: stampAnimation,
          // reduced-motion 일 때는 회전/스케일 없이 즉시 표시
          ...(reducedMotion ? { transform: 'rotate(-4deg)' } : {}),
        }}
      />

      <style jsx global>{`
        @keyframes byct-stamp-drop {
          /* 0~0.5s: 위에서 슉 내려옴 (ease-in, 점점 빨라짐) */
          0% {
            transform: translateY(-100px) scale(1.8) rotate(0deg);
            opacity: 0;
            animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.3);
          }
          29% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 1;
            animation-timing-function: cubic-bezier(0.4, 1.6, 0.6, 1);
          }
          /* 0.5~0.55s: 임팩트 — 살짝 눌리고 기울어짐 */
          32% {
            transform: translateY(0) scale(0.95) rotate(-8deg);
            opacity: 1;
          }
          /* 0.55~0.8s: 잉크 번짐 단계 — 스탬프는 거의 그대로 */
          47% {
            transform: translateY(0) scale(1) rotate(-6deg);
            opacity: 1;
          }
          /* 0.8~1.2s: 흔들림 (±2~3deg 미세하게) */
          53% { transform: translateY(0) scale(1) rotate(-4deg); }
          58% { transform: translateY(0) scale(1) rotate(-8deg); }
          64% { transform: translateY(0) scale(1) rotate(-5deg); }
          70% { transform: translateY(0) scale(1) rotate(-7deg); }
          /* 1.2~1.7s: 정착 — 살짝 기울어진 채로 고정 */
          100% {
            transform: translateY(0) scale(1) rotate(-6deg);
            opacity: 1;
          }
        }

        @keyframes byct-ink-spread {
          0%,
          28% {
            transform: scale(0);
            opacity: 0;
          }
          /* 임팩트 직후 ~ 0.8s: 잉크가 빠르게 퍼지며 페이드 */
          32% {
            transform: scale(0.4);
            opacity: 0.7;
          }
          47% {
            transform: scale(1.3);
            opacity: 0.4;
          }
          60% {
            transform: scale(1.7);
            opacity: 0;
          }
          100% {
            transform: scale(1.7);
            opacity: 0;
          }
        }

        @keyframes byct-splash-fadeout {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
