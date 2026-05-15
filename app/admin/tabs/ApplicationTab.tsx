'use client'
import { useCallback, useEffect, useState } from 'react'
import { Stamp, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import type { AdminUser } from '@/components/AdminProvider'
import {
  formatDate,
  formatPhone,
  type ApplicationRow,
  type AppStatusFilter,
} from './shared'

interface Props {
  admin: AdminUser
  onPendingCountChange?: (count: number) => void
}

export default function ApplicationTab({ admin, onPendingCountChange }: Props) {
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationCenterId, setApplicationCenterId] = useState<number | null>(
    admin.role === 'center' ? (admin.center_id ?? null) : null,
  )
  const [processingAppId, setProcessingAppId] = useState<string | null>(null)
  const [appStatusFilter, setAppStatusFilter] = useState<AppStatusFilter>('pending')

  const loadApplications = useCallback(async (centerId: number | null, statusFilter: AppStatusFilter) => {
    setApplicationsLoading(true)
    try {
      const effectiveCenterId = admin.role === 'center' ? (admin.center_id ?? null) : centerId
      if (admin.role === 'center' && !admin.center_id) {
        setApplications([])
        return
      }

      let q = supabase
        .from('applications')
        .select('id, participant_id, participant_name, participant_phone, center_id, center_name, status, applied_at')
        .order('applied_at', { ascending: true })
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      if (effectiveCenterId !== null) q = q.eq('center_id', effectiveCenterId)

      const { data } = await q
      setApplications((data ?? []) as ApplicationRow[])
    } finally {
      setApplicationsLoading(false)
    }
  }, [admin])

  const loadPendingCount = useCallback(async () => {
    try {
      let q = supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (admin.role === 'center') {
        if (!admin.center_id) { onPendingCountChange?.(0); return }
        q = q.eq('center_id', admin.center_id)
      }
      const { count } = await q
      onPendingCountChange?.(count ?? 0)
    } catch {
      // 카운트 실패는 조용히 무시
    }
  }, [admin, onPendingCountChange])

  async function handleSetApplicationStatus(
    app: ApplicationRow,
    newStatus: 'approved' | 'rejected' | 'waiting',
  ) {
    if (admin.role === 'center' && admin.center_id !== app.center_id) return

    const verbMap: Record<typeof newStatus, string> = {
      approved: '승인',
      rejected: '거절',
      waiting: '대기 처리',
    }
    if (!confirm(`"${app.participant_name}" 님의 신청을 ${verbMap[newStatus]} 하시겠습니까?`)) return

    setProcessingAppId(app.id)
    try {
      const { error: updErr } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', app.id)
      if (updErr) throw updErr

      const pushMessages: Record<typeof newStatus, string> = {
        approved: `✅ ${app.center_name} 신청이 승인되었습니다`,
        rejected: `❌ ${app.center_name} 신청이 거절되었습니다`,
        waiting: `📋 ${app.center_name} 대기열에 등록되었습니다`,
      }
      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: app.participant_id,
          title: 'B.Y.C.T 스탬프투어',
          body: pushMessages[newStatus],
          tag: `app-${app.id}-${newStatus}`,
          url: '/programs',
        }),
      }).catch((err) => console.warn('[push] 발송 실패:', err))

      if (appStatusFilter === 'all' || appStatusFilter === newStatus) {
        setApplications(prev =>
          prev.map(a => (a.id === app.id ? { ...a, status: newStatus } : a)),
        )
      } else {
        setApplications(prev => prev.filter(a => a.id !== app.id))
      }

      loadPendingCount()
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '처리에 실패했습니다. 다시 시도해주세요.',
      )
    } finally {
      setProcessingAppId(null)
    }
  }

  async function handleIssueStamp(app: ApplicationRow) {
    if (admin.role === 'center' && admin.center_id !== app.center_id) return

    if (!confirm(`"${app.participant_name}" 님에게 ${app.center_name} 스탬프를 발급하시겠습니까?`)) return

    setProcessingAppId(app.id)
    try {
      // 1) 이미 스탬프가 있는지 확인 (1기관 1스탬프 원칙)
      const { data: existing } = await supabase
        .from('stamp_records')
        .select('id')
        .eq('participant_id', app.participant_id)
        .eq('center_id', app.center_id)
        .maybeSingle()

      if (!existing) {
        const { error: stampErr } = await supabase.from('stamp_records').insert({
          participant_id: app.participant_id,
          participant_name: app.participant_name,
          participant_phone: app.participant_phone,
          center_id: app.center_id,
          center_name: app.center_name,
          approved_by: admin.name,
        })
        if (stampErr) throw stampErr
      }

      const { error: updErr } = await supabase
        .from('applications')
        .update({ status: 'approved' })
        .eq('id', app.id)
      if (updErr) throw updErr

      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: app.participant_id,
          title: 'B.Y.C.T 스탬프투어',
          body: `🎉 ${app.center_name}에서 스탬프가 발급되었어요!`,
          tag: `stamp-${app.id}`,
          url: '/stamps',
        }),
      }).catch((err) => console.warn('[push] 발송 실패:', err))

      if (appStatusFilter === 'all' || appStatusFilter === 'approved') {
        setApplications(prev =>
          prev.map(a => (a.id === app.id ? { ...a, status: 'approved' } : a)),
        )
      } else {
        setApplications(prev => prev.filter(a => a.id !== app.id))
      }

      loadPendingCount()
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '스탬프 발급에 실패했습니다. 다시 시도해주세요.',
      )
    } finally {
      setProcessingAppId(null)
    }
  }

  useEffect(() => {
    loadApplications(applicationCenterId, appStatusFilter)
    loadPendingCount()
  }, [applicationCenterId, appStatusFilter, loadApplications, loadPendingCount])

  return (
    <div className="px-4 space-y-4">
      {admin.role === 'center' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에 신청한 참가자만 표시됩니다.
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            "승인" 또는 "스탬프 찍기"를 누르면 스탬프가 자동 발급됩니다.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {([
            { v: 'all', l: '전체' },
            { v: 'pending', l: '대기중' },
            { v: 'waiting', l: '대기열' },
            { v: 'approved', l: '승인됨' },
            { v: 'rejected', l: '거절됨' },
          ] as { v: AppStatusFilter; l: string }[]).map(opt => {
            const active = appStatusFilter === opt.v
            return (
              <button
                key={opt.v}
                onClick={() => setAppStatusFilter(opt.v)}
                className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.l}
              </button>
            )
          })}
        </div>
      </div>

      {admin.role === 'super' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 필터</label>
          <select
            value={applicationCenterId ?? ''}
            onChange={e => {
              const v = e.target.value
              setApplicationCenterId(v === '' ? null : Number(v))
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="">전체 기관</option>
            {ORGANIZATIONS.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            {appStatusFilter === 'all' ? '📋'
              : appStatusFilter === 'pending' ? '⏳'
              : appStatusFilter === 'waiting' ? '⏰'
              : appStatusFilter === 'approved' ? '✅'
              : '❌'} 신청 목록
            {!applicationsLoading && (
              <span className="text-xs text-gray-400 font-normal">{applications.length}건</span>
            )}
          </h2>
          <button
            onClick={() => { loadApplications(applicationCenterId, appStatusFilter); loadPendingCount() }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={13} className={applicationsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {applicationsLoading ? (
          <div className="py-10 flex justify-center">
            <RefreshCw size={18} className="animate-spin text-gray-300" />
          </div>
        ) : applications.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-gray-500 font-medium">
              {appStatusFilter === 'all' && '신청 기록이 없습니다'}
              {appStatusFilter === 'pending' && '대기 중인 신청이 없습니다'}
              {appStatusFilter === 'waiting' && '대기열에 있는 신청이 없습니다'}
              {appStatusFilter === 'approved' && '승인된 신청이 없습니다'}
              {appStatusFilter === 'rejected' && '거절된 신청이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {applications.map(app => {
              const org = ORGANIZATIONS.find(o => o.id === app.center_id)
              const processing = processingAppId === app.id
              return (
                <div key={app.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs text-gray-500 font-medium truncate">{app.center_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                          app.status === 'waiting'  ? 'bg-blue-100 text-blue-700' :
                          app.status === 'approved' ? 'bg-green-100 text-green-700' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {app.status === 'pending'  ? '대기중'
                            : app.status === 'waiting'  ? '대기열'
                            : app.status === 'approved' ? '승인됨'
                            : app.status === 'rejected' ? '거절됨'
                            : app.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{app.participant_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatPhone(app.participant_phone)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        신청 {formatDate(app.applied_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    <button
                      onClick={() => handleSetApplicationStatus(app, 'approved')}
                      disabled={processing}
                      className="py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleSetApplicationStatus(app, 'rejected')}
                      disabled={processing}
                      className="py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleSetApplicationStatus(app, 'waiting')}
                      disabled={processing}
                      className="py-2.5 bg-yellow-500 text-white text-xs font-bold rounded-xl hover:bg-yellow-600 active:scale-95 transition-all disabled:opacity-50"
                    >
                      대기
                    </button>
                  </div>

                  <button
                    onClick={() => handleIssueStamp(app)}
                    disabled={processing}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> 처리 중...
                      </>
                    ) : (
                      <>
                        <Stamp size={14} /> 스탬프 찍기
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
