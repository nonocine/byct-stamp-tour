'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, BookOpen, Stamp, BarChart3, LogOut, LogIn } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/components/AuthProvider'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/programs', label: '프로그램', icon: BookOpen },
  { href: '/stamps', label: '내 스탬프', icon: Stamp },
  { href: '/admin', label: '관리자', icon: BarChart3 },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading, signOut } = useAuth()

  const isAdminPath = pathname?.startsWith('/admin') ?? false

  function handleSignOut() {
    signOut()
    router.push('/login')
  }

  return (
    <>
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">BY</span>
            </div>
            <span className="font-bold text-gray-900 text-sm">B.Y.C.T 스탬프투어</span>
          </Link>

          {isAdminPath ? (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              관리자 모드
            </span>
          ) : !loading && (
            profile ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium hidden sm:block">
                  {profile.name} 님
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <LogOut size={13} />
                  로그아웃
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-blue-700 transition-colors"
              >
                <LogIn size={13} />
                로그인
              </Link>
            )
          )}
        </div>
      </header>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-area-bottom">
        <div className="max-w-2xl mx-auto px-2">
          <div className="flex items-center justify-around h-16">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                    active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={clsx('text-xs', active ? 'font-semibold' : 'font-normal')}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
