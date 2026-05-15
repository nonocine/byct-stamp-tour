'use client'
import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Users, Stamp, TrendingUp, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import type { AdminUser } from '@/components/AdminProvider'
import {
  PAGE_SIZE,
  formatPhone,
  formatDate,
  type StatsData,
  type DashboardProfileRow,
} from './shared'

interface Props {
  admin: AdminUser
}

export default function DashboardTab({ admin }: Props) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [dashParticipants, setDashParticipants] = useState<DashboardProfileRow[]>([])
  const [dashLoading, setDashLoading] = useState(false)
  const [dashPage, setDashPage] = useState(0)
  const [dashTotal, setDashTotal] = useState(0)
  const [ranking, setRanking] = useState<{ id: string; name: string; phoneSuffix: string; count: number }[]>([])
  const [rankLoading, setRankLoading] = useState(false)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      // ── 슈퍼관리자: 전체 데이터 ──────────────────────────────────────
      if (admin.role === 'super') {
        const [profilesRes, stampsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('stamp_records').select('center_id, participant_id'),
        ])
        const totalProfiles = profilesRes.count ?? 0
        const allStamps: { center_id: number; participant_id: string }[] = stampsRes.data ?? []
        const totalStamps = allStamps.length

        const participantOrgs: Record<string, Set<number>> = {}
        allStamps.forEach(r => {
          if (!participantOrgs[r.participant_id]) participantOrgs[r.participant_id] = new Set()
          participantOrgs[r.participant_id].add(r.center_id)
        })
        const completions = Object.values(participantOrgs).filter(s => s.size >= 17).length

        const countMap: Record<number, number> = {}
        allStamps.forEach(s => { countMap[s.center_id] = (countMap[s.center_id] ?? 0) + 1 })

        const centerBreakdown = ORGANIZATIONS.map(org => ({
          center_id: org.id,
          center_name: org.name,
          count: countMap[org.id] ?? 0,
        })).sort((a, b) => b.count - a.count)

        setStats({ totalProfiles, totalStamps, completions, centerBreakdown })
        return
      }

      // ── 기관관리자: 본인 기관 스탬프를 받은 참가자만 ───────────────
      if (!admin.center_id) {
        setStats({ totalProfiles: 0, totalStamps: 0, completions: 0, centerBreakdown: [] })
        return
      }

      const { data: ourStamps } = await supabase
        .from('stamp_records')
        .select('participant_id')
        .eq('center_id', admin.center_id)
      const myPids = Array.from(
        new Set((ourStamps ?? []).map((r: any) => r.participant_id).filter(Boolean))
      ) as string[]

      const totalProfiles = myPids.length
      const totalStamps = (ourStamps ?? []).length

      const { data: allTheirStamps } = myPids.length > 0
        ? await supabase
            .from('stamp_records')
            .select('center_id, participant_id')
            .in('participant_id', myPids)
        : { data: [] as any[] }

      const participantOrgs: Record<string, Set<number>> = {}
      ;(allTheirStamps ?? []).forEach((r: any) => {
        if (!participantOrgs[r.participant_id]) participantOrgs[r.participant_id] = new Set()
        participantOrgs[r.participant_id].add(r.center_id)
      })
      const completions = Object.values(participantOrgs).filter(s => s.size >= 17).length

      const myOrg = ORGANIZATIONS.find(o => o.id === admin.center_id)
      const centerBreakdown = myOrg
        ? [{ center_id: myOrg.id, center_name: myOrg.name, count: totalStamps }]
        : []

      setStats({ totalProfiles, totalStamps, completions, centerBreakdown })
    } finally {
      setStatsLoading(false)
    }
  }, [admin])

  const loadRanking = useCallback(async () => {
    setRankLoading(true)
    try {
      let scopedPids: string[] | null = null
      if (admin.role === 'center') {
        if (!admin.center_id) { setRanking([]); return }
        const { data: pidRows } = await supabase
          .from('stamp_records')
          .select('participant_id')
          .eq('center_id', admin.center_id)
        scopedPids = Array.from(
          new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
        ) as string[]
        if (scopedPids.length === 0) { setRanking([]); return }
      }

      let q = supabase
        .from('stamp_records')
        .select('participant_id, participant_name, participant_phone, center_id')
      if (scopedPids) q = q.in('participant_id', scopedPids)
      const { data } = await q
      if (!data) return

      const map: Record<string, { name: string; phone: string; centers: Set<number> }> = {}
      ;(data as any[]).forEach(s => {
        if (!s.participant_id) return
        if (!map[s.participant_id]) {
          map[s.participant_id] = {
            name: s.participant_name ?? '',
            phone: s.participant_phone ?? '',
            centers: new Set(),
          }
        }
        map[s.participant_id].centers.add(s.center_id)
      })

      const rows = Object.entries(map)
        .map(([id, v]) => ({
          id,
          name: v.name || '익명',
          phoneSuffix: (v.phone || '').slice(-4),
          count: v.centers.size,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      setRanking(rows)
    } finally {
      setRankLoading(false)
    }
  }, [admin])

  const loadDashParticipants = useCallback(async (p: number) => {
    setDashLoading(true)
    try {
      let scopedIds: string[] | null = null
      if (admin.role === 'center') {
        if (!admin.center_id) { setDashParticipants([]); setDashTotal(0); return }
        const { data: pidRows } = await supabase
          .from('stamp_records')
          .select('participant_id')
          .eq('center_id', admin.center_id)
        scopedIds = Array.from(
          new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
        ) as string[]
        if (scopedIds.length === 0) { setDashParticipants([]); setDashTotal(0); return }
      }

      const from = p * PAGE_SIZE
      let pq = supabase
        .from('profiles')
        .select('id, name, phone, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (scopedIds) pq = pq.in('id', scopedIds)

      const { data: profiles, count } = await pq

      if (!profiles) return
      setDashTotal(count ?? 0)

      const ids = profiles.map(pr => pr.id)
      const { data: stampData } = ids.length > 0
        ? await supabase.from('stamp_records').select('participant_id').in('participant_id', ids)
        : { data: [] }

      const countById: Record<string, number> = {}
      ;(stampData ?? []).forEach(s => {
        if (s.participant_id) countById[s.participant_id] = (countById[s.participant_id] ?? 0) + 1
      })
      setDashParticipants(profiles.map(pr => ({ ...pr, stampCount: countById[pr.id] ?? 0 })))
    } finally {
      setDashLoading(false)
    }
  }, [admin])

  // 첫 진입 시 로드
  useEffect(() => {
    loadStats()
    loadRanking()
    loadDashParticipants(0)
  }, [loadStats, loadRanking, loadDashParticipants])

  // 페이지 변경 시 재fetch
  useEffect(() => {
    loadDashParticipants(dashPage)
  }, [dashPage, loadDashParticipants])

  // 30초 주기 랭킹 갱신
  useEffect(() => {
    const id = setInterval(() => loadRanking(), 30000)
    return () => clearInterval(id)
  }, [loadRanking])

  const dashTotalPages = Math.ceil(dashTotal / PAGE_SIZE)

  return (
    <div className="px-4 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { loadStats(); loadDashParticipants(dashPage); loadRanking() }}
          disabled={statsLoading}
          className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={statsLoading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {statsLoading || !stats ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`bg-gray-100 rounded-2xl h-24 animate-pulse ${i === 2 ? 'col-span-2' : ''}`} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-600 rounded-2xl p-4 text-white">
              <Users size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{stats.totalProfiles}</p>
              <p className="text-sm text-blue-200 mt-0.5">총 참가자</p>
            </div>
            <div className="bg-indigo-600 rounded-2xl p-4 text-white">
              <Stamp size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{stats.totalStamps}</p>
              <p className="text-sm text-indigo-200 mt-0.5">총 스탬프</p>
            </div>
            <div className="bg-green-600 rounded-2xl p-4 text-white col-span-2">
              <TrendingUp size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{stats.completions}</p>
              <p className="text-sm text-green-200 mt-0.5">17개 기관 완주자</p>
            </div>
          </div>

          {/* 실시간 스탬프 랭킹 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                🏆 실시간 스탬프 랭킹
              </h2>
              <button onClick={loadRanking} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={13} className={rankLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            {ranking.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {rankLoading ? '불러오는 중...' : '아직 스탬프가 없습니다'}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ranking.map((r, idx) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                  const progress = Math.min(100, Math.round((r.count / 17) * 100))
                  return (
                    <div key={r.id} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 flex-shrink-0 text-center">
                          {medal
                            ? <span className="text-xl">{medal}</span>
                            : <span className="text-sm font-bold text-gray-500">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {r.name}
                              {r.phoneSuffix && <span className="text-xs text-gray-400 ml-1.5">({r.phoneSuffix})</span>}
                            </p>
                            <p className="text-xs font-bold text-blue-600 flex-shrink-0">
                              {r.count}<span className="font-normal text-gray-400">/17</span>
                            </p>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress}%`,
                                background: r.count >= 17
                                  ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                                  : 'linear-gradient(90deg, #3B82F6, #6366F1)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <BarChart3 size={15} /> 기관별 스탬프 현황
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.centerBreakdown.map(({ center_id, center_name, count }, idx) => {
                const org = ORGANIZATIONS.find(o => o.id === center_id)
                const maxCount = Math.max(...stats.centerBreakdown.map(c => c.count), 1)
                return (
                  <div key={center_id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</span>
                    {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{center_name}</p>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${count > 0 ? Math.round((count / maxCount) * 100) : 0}%`, backgroundColor: org?.color ?? '#3B82F6' }} />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">{count}명</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* 참가자 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Users size={15} /> 참가자 목록
            {dashTotal > 0 && <span className="text-xs text-gray-400 font-normal ml-1">총 {dashTotal}명</span>}
          </h2>
        </div>
        {dashLoading ? (
          <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
        ) : dashParticipants.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">등록된 참가자가 없습니다</div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {dashParticipants.map(p => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatPhone(p.phone)} · {formatDate(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-blue-600">{p.stampCount}<span className="text-xs font-normal text-gray-400">/17</span></p>
                    <p className="text-xs text-gray-400">스탬프</p>
                  </div>
                </div>
              ))}
            </div>
            {dashTotalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
                <button onClick={() => setDashPage(p => Math.max(0, p - 1))} disabled={dashPage === 0} className="flex items-center gap-1 text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors">
                  <ChevronLeft size={14} /> 이전
                </button>
                <span className="text-xs text-gray-500">{dashPage + 1} / {dashTotalPages}</span>
                <button onClick={() => setDashPage(p => Math.min(dashTotalPages - 1, p + 1))} disabled={dashPage >= dashTotalPages - 1} className="flex items-center gap-1 text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors">
                  다음 <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
