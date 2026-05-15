'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Shield, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/components/AdminProvider'
import DashboardTab from './tabs/DashboardTab'
import StampTab from './tabs/StampTab'
import ParticipantTab from './tabs/ParticipantTab'
import AdminTab from './tabs/AdminTab'
import ReviewTab from './tabs/ReviewTab'
import ApplicationTab from './tabs/ApplicationTab'
import ProgramTab from './tabs/ProgramTab'
import ReportTab from './tabs/ReportTab'
import LinkTab from './tabs/LinkTab'

type Tab = 'dashboard' | 'stamp' | 'participants' | 'admins' | 'links' | 'reviews' | 'applications' | 'programs' | 'reports'

export default function AdminPage() {
  const router = useRouter()
  const { admin, loading, logoutAdmin } = useAdmin()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!loading && !admin) router.replace('/admin/login')
  }, [admin, loading, router])

  // 인증 직후 대기 인원 카운트 로드 (탭 배지용 — 신청 탭에 들어가지 않아도 표시되어야 함)
  useEffect(() => {
    if (loading || !admin) return
    let cancelled = false
    ;(async () => {
      try {
        let q = supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (admin.role === 'center') {
          if (!admin.center_id) { if (!cancelled) setPendingCount(0); return }
          q = q.eq('center_id', admin.center_id)
        }
        const { count } = await q
        if (!cancelled) setPendingCount(count ?? 0)
      } catch {
        // 카운트 실패는 조용히 무시
      }
    })()
    return () => { cancelled = true }
  }, [admin, loading])

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={24} className="animate-spin text-gray-300" />
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    )
  }
  if (!admin) return null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '대시보드' },
    { key: 'applications', label: pendingCount > 0 ? `신청 대기 (${pendingCount})` : '신청 대기' },
    { key: 'stamp', label: '스탬프 찍기' },
    { key: 'participants', label: '참가자 관리' },
    { key: 'reviews', label: '평가 모아보기' },
    { key: 'links', label: '기관 링크' },
    { key: 'programs', label: '프로그램 관리' },
    { key: 'reports', label: '보고서' },
    ...(admin.role === 'super' ? [{ key: 'admins' as Tab, label: '관리자 관리' }] : []),
  ]

  return (
    <div className="py-5">
      <div className="px-4 mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-gray-700" />
            <p className="text-sm font-bold text-gray-900">{admin.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${admin.role === 'super' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {admin.role === 'super' ? '슈퍼관리자' : admin.center_name ?? '센터관리자'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">B.Y.C.T 관리자 페이지</p>
        </div>
        <button
          onClick={() => { logoutAdmin(); router.replace('/admin/login') }}
          className="flex items-center gap-1.5 text-gray-500 text-xs bg-gray-100 px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors"
        >
          <LogOut size={13} /> 로그아웃
        </button>
      </div>

      <div className="px-4 mb-4 grid grid-cols-4 gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 px-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors ${tab === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab admin={admin} />}
      {tab === 'applications' && <ApplicationTab admin={admin} onPendingCountChange={setPendingCount} />}
      {tab === 'stamp' && <StampTab admin={admin} />}
      {tab === 'participants' && <ParticipantTab admin={admin} />}
      {tab === 'reviews' && <ReviewTab admin={admin} />}
      {tab === 'links' && <LinkTab admin={admin} />}
      {tab === 'programs' && <ProgramTab admin={admin} />}
      {tab === 'reports' && <ReportTab admin={admin} />}
      {tab === 'admins' && admin.role === 'super' && <AdminTab admin={admin} />}
    </div>
  )
}
