import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'B.Y.C.T 부산 청소년 스탬프투어',
  description: '부산 17개 청소년기관을 체험하고 스탬프를 모아 완주 인증을 받으세요!',
  metadataBase: new URL('https://byct-stamp-tour.vercel.app'),
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'B.Y.C.T 부산 청소년 스탬프투어',
    description: '부산 17개 청소년기관을 체험하고 스탬프를 모아 완주 인증을 받으세요!',
    images: [
      {
        url: 'https://byct-stamp-tour.vercel.app/logos/동래구청소년센터.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a3a8c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <Navigation />
          <main className="max-w-2xl mx-auto pt-14 pb-20">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
