import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'B.Y.C.T 부산 청소년 스탬프투어',
  description: '부산 청소년 체험단 스탬프투어 — 17개 기관을 체험하고 스탬프를 모아보세요!',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-2xl mx-auto pt-14 pb-20">
          {children}
        </main>
      </body>
    </html>
  )
}
