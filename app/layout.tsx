import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'B.Y.C.T 부산 청소년 스탬프 투어',
  description: '부산 17개 청소년수련시설 스탬프 투어 프로그램',
  metadataBase: new URL('https://ppgthptyjjrcmkeearfx.supabase.co'),
  openGraph: {
    title: 'B.Y.C.T 부산 청소년 스탬프 투어',
    description: '부산 17개 청소년수련시설 스탬프 투어 프로그램',
    images: [{ url: '/og-image.png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
