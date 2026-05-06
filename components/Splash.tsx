'use client'
import { useEffect, useState } from 'react'

export default function Splash() {
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setMounted(false), 2500)
    return () => clearTimeout(t)
  }, [])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white pointer-events-none"
      style={{ animation: 'byct-splash 2500ms ease-in-out forwards' }}
    >
      <img
        src="/association-logo.png"
        alt="B.Y.C.T"
        width={200}
        height={200}
        className="object-contain"
      />
      <p className="mt-5 text-lg font-bold text-gray-800 tracking-tight">
        B.Y.C.T 스탬프투어
      </p>

      <style jsx global>{`
        @keyframes byct-splash {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
