'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, Users, Stamp, TrendingUp, RefreshCw, Search, CheckCircle, XCircle,
  LogOut, Shield, Plus, Trash2, Phone, UserCheck, ChevronLeft, ChevronRight,
  Edit2, X, Save, ChevronDown, ChevronUp, Download, Link2, ExternalLink, Star,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/components/AdminProvider'
import { ORGANIZATIONS } from '@/lib/data'
import { fetchAllPrograms } from '@/lib/programs'
import type { Program } from '@/lib/types'
import OrgIcon from '@/components/OrgIcon'
import ProgramEditModal from '@/components/ProgramEditModal'

type Tab = 'dashboard' | 'stamp' | 'participants' | 'admins' | 'links' | 'reviews' | 'applications' | 'programs'

const PAGE_SIZE = 20

// ── 타입 정의 ────────────────────────────────────────────────────────────────

interface StatsData {
  totalProfiles: number
  totalStamps: number
  completions: number
  centerBreakdown: { center_id: number; center_name: string; count: number }[]
}

interface DashboardProfileRow {
  id: string
  name: string
  phone: string
  created_at: string
  stampCount: number
}

interface ProfileResult {
  id: string
  name: string
  phone: string
  birthdate: string
}

interface ParticipantRow {
  id: string
  name: string
  phone: string
  birthdate: string
  created_at: string
  stampCount: number
}

interface StampRecordRow {
  id: string
  center_id: number
  center_name: string
  approved_by: string
  stamped_at: string
}

interface AdminRow {
  id: string
  name: string
  phone: string
  role: 'super' | 'center'
  center_id: number | null
  center_name: string | null
}

interface ReviewRow {
  id: string
  participant_id: string
  participant_name: string
  center_id: number
  center_name: string
  rating: number
  comment: string | null
  created_at: string
}

interface ReviewSummary {
  center_id: number
  center_name: string
  count: number
  avg: number
}

interface ApplicationRow {
  id: string
  participant_id: string
  participant_name: string
  participant_phone: string
  center_id: number
  center_name: string
  status: 'pending' | 'approved'
  applied_at: string
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function formatBirthdate(bd: string) {
  const d = (bd ?? '').replace(/\D/g, '')
  if (d.length !== 8) return bd ?? ''
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { admin, loading, logoutAdmin } = useAdmin()
  const [tab, setTab] = useState<Tab>('dashboard')

  // ── 대시보드 ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [dashParticipants, setDashParticipants] = useState<DashboardProfileRow[]>([])
  const [dashLoading, setDashLoading] = useState(false)
  const [dashPage, setDashPage] = useState(0)
  const [dashTotal, setDashTotal] = useState(0)
  const [ranking, setRanking] = useState<{ id: string; name: string; phoneSuffix: string; count: number }[]>([])
  const [rankLoading, setRankLoading] = useState(false)

  // ── 스탬프 찍기 ──────────────────────────────────────────────────────────
  const [searchPhone, setSearchPhone] = useState('')
  const [foundProfile, setFoundProfile] = useState<ProfileResult | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [alreadyStamped, setAlreadyStamped] = useState(false)
  const [existingStampId, setExistingStampId] = useState<string | null>(null)
  const [existingStampDate, setExistingStampDate] = useState<string | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [stamping, setStamping] = useState(false)
  const [stampSuccess, setStampSuccess] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  // 별도 "스탬프 취소" 섹션 전용 state
  const [cancelSearchPhone, setCancelSearchPhone] = useState('')
  const [cancelSearching, setCancelSearching] = useState(false)
  const [cancelSearchError, setCancelSearchError] = useState('')
  const [cancelTarget, setCancelTarget] = useState<{
    stampId: string
    stampedAt: string
    name: string
    phone: string
    birthdate: string
  } | null>(null)
  const [cancelProcessing, setCancelProcessing] = useState(false)
  const [cancelDoneMsg, setCancelDoneMsg] = useState(false)

  // ── 참가자 관리 ──────────────────────────────────────────────────────────
  const [pSearch, setPSearch] = useState('')
  const [pCenterId, setPCenterId] = useState<number | null>(null)
  const [pList, setPList] = useState<ParticipantRow[]>([])
  const [pLoading, setPLoading] = useState(false)
  const [pPage, setPPage] = useState(0)
  const [pTotal, setPTotal] = useState(0)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', birthdate: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [expandedPId, setExpandedPId] = useState<string | null>(null)
  const [pStamps, setPStamps] = useState<StampRecordRow[]>([])
  const [pStampsLoading, setPStampsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ── 관리자 관리 ──────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', password: '', role: 'center' as 'super' | 'center', center_id: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')

  // ── 기관 링크 관리 ────────────────────────────────────────────────────────
  const [linkUrls, setLinkUrls] = useState<Record<number, string>>({})
  const [linksLoading, setLinksLoading] = useState(false)
  const [savingLinkId, setSavingLinkId] = useState<number | null>(null)
  const [savedLinkId, setSavedLinkId] = useState<number | null>(null)

  // ── 평가 (별점/한줄평) ────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewCenterId, setReviewCenterId] = useState<number | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  // ── 프로그램 신청 대기 ───────────────────────────────────────────────────
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [applicationCenterId, setApplicationCenterId] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [processingAppId, setProcessingAppId] = useState<string | null>(null)

  // ── 프로그램 관리 ────────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)

  async function loadPrograms() {
    setProgramsLoading(true)
    try {
      const data = await fetchAllPrograms()
      setPrograms(data)
    } finally {
      setProgramsLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && !admin) router.replace('/admin/login')
  }, [admin, loading, router])

  useEffect(() => {
    if (admin?.role === 'center' && admin.center_id) {
      setSelectedOrgId(admin.center_id)
      setPCenterId(admin.center_id)
    }
  }, [admin])

  // ── 대시보드 데이터 ───────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    if (!admin) return
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

      // 본인 기관 참가자들의 모든 기관 스탬프 (완주 계산용)
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
    if (!admin) return
    setRankLoading(true)
    try {
      // 기관관리자: 본인 기관 참가자만 랭킹에 포함
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
    if (!admin) return
    setDashLoading(true)
    try {
      // 기관관리자: 본인 기관 스탬프를 받은 참가자만
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

  // ── 참가자 관리 데이터 ────────────────────────────────────────────────────

  const loadParticipants = useCallback(async (p: number, search: string, centerId: number | null) => {
    if (!admin) return
    setPLoading(true)
    try {
      // 기관관리자는 본인 기관으로 강제 (UI 우회 방어)
      const effectiveCenterId = admin.role === 'center' ? (admin.center_id ?? null) : centerId
      if (admin.role === 'center' && !admin.center_id) {
        setPList([])
        setPTotal(0)
        return
      }

      let filterIds: string[] | null = null
      if (effectiveCenterId !== null) {
        const { data: pidRows } = await supabase
          .from('stamp_records')
          .select('participant_id')
          .eq('center_id', effectiveCenterId)
        filterIds = Array.from(
          new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
        )
        if (filterIds.length === 0) {
          setPList([])
          setPTotal(0)
          return
        }
      }

      const from = p * PAGE_SIZE
      let query = supabase
        .from('profiles')
        .select('id, name, phone, birthdate, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (filterIds) query = query.in('id', filterIds)

      const term = search.trim()
      if (term) {
        const raw = term.replace(/\D/g, '')
        const isNumericOnly = raw.length > 0 && raw.length === term.replace(/[\s-]/g, '').length
        if (isNumericOnly) {
          query = query.ilike('phone', `%${raw}%`)
        } else if (raw.length >= 3) {
          query = query.or(`name.ilike.%${term}%,phone.ilike.%${raw}%`)
        } else {
          query = query.ilike('name', `%${term}%`)
        }
      }

      const { data: profiles, count } = await query
      if (!profiles) return
      setPTotal(count ?? 0)

      const ids = profiles.map(pr => pr.id)
      const { data: stampData } = ids.length > 0
        ? await supabase.from('stamp_records').select('participant_id').in('participant_id', ids)
        : { data: [] }

      const countById: Record<string, number> = {}
      ;(stampData ?? []).forEach((s: any) => {
        if (s.participant_id) countById[s.participant_id] = (countById[s.participant_id] ?? 0) + 1
      })
      setPList(profiles.map(pr => ({ ...pr, stampCount: countById[pr.id] ?? 0 })))
    } finally {
      setPLoading(false)
    }
  }, [admin])


  async function loadParticipantStamps(participantId: string) {
    setPStampsLoading(true)
    try {
      const { data, error } = await supabase
        .from('stamp_records')
        .select('*')
        .eq('participant_id', participantId)

      console.log('participant.id:', participantId)
      console.log('stamp data:', data)
      console.log('stamp error:', error)

      const stamps = (data ?? [])
        .map((s: any) => ({
          id: s.id,
          center_id: s.center_id,
          center_name: s.center_name,
          approved_by: s.approved_by,
          stamped_at: s.stamped_at,
        }))
        .sort((a, b) => new Date(b.stamped_at).getTime() - new Date(a.stamped_at).getTime())

      setPStamps(stamps)
    } finally {
      setPStampsLoading(false)
    }
  }

  async function handleSaveParticipant() {
    if (!editId || admin?.role !== 'super') return
    setSaveError('')
    const { name, phone, birthdate } = editForm
    const trimmedName = name.trim()
    if (!trimmedName) { setSaveError('이름을 입력해주세요'); return }
    const rawPhone = phone.replace(/\D/g, '')
    if (rawPhone.length < 10) { setSaveError('올바른 전화번호를 입력해주세요'); return }
    const rawBirth = birthdate.replace(/\D/g, '')
    if (rawBirth.length !== 8) { setSaveError('생년월일 8자리를 입력해주세요 (예: 20010101)'); return }

    setSaving(true)
    try {
      const { data: dup } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', rawPhone)
        .neq('id', editId)
        .maybeSingle()
      if (dup) { setSaveError('이미 사용 중인 전화번호입니다'); return }

      const { error } = await supabase.from('profiles').update({
        name: trimmedName,
        phone: rawPhone,
        birthdate: rawBirth,
      }).eq('id', editId)
      if (error) throw error

      await supabase.from('stamp_records').update({
        participant_name: trimmedName,
        participant_phone: rawPhone,
      }).eq('participant_id', editId)

      setEditId(null)
      loadParticipants(pPage, pSearch, pCenterId)
    } catch (e: any) {
      setSaveError(e.message ?? '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteParticipant(p: ParticipantRow) {
    if (admin?.role !== 'super') return
    if (!confirm(`"${p.name}" 참가자를 삭제하면 스탬프 기록(${p.stampCount}개)도 함께 삭제됩니다.\n정말 삭제하시겠습니까?`)) return
    try {
      const { error: stampErr } = await supabase.from('stamp_records').delete().eq('participant_id', p.id)
      if (stampErr) throw stampErr
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', p.id)
      if (profErr) throw profErr
      if (expandedPId === p.id) setExpandedPId(null)
      loadParticipants(pPage, pSearch, pCenterId)
    } catch (e: any) {
      alert('삭제에 실패했습니다: ' + (e.message ?? ''))
    }
  }

  async function handleDeleteStamp(stampId: string) {
    if (admin?.role !== 'super') return
    if (!confirm('이 스탬프 기록을 삭제할까요?')) return
    const { error } = await supabase.from('stamp_records').delete().eq('id', stampId)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setPStamps(prev => prev.filter(s => s.id !== stampId))
    loadParticipants(pPage, pSearch, pCenterId)
  }

  async function handleExportExcel() {
    if (!admin) return
    setExporting(true)
    try {
      const centerId = admin.role === 'center' ? admin.center_id : pCenterId

      // 1. 기관 필터 시 해당 기관 참가자 ID 목록
      let filterIds: string[] | null = null
      if (centerId !== null && centerId !== undefined) {
        const { data: pidRows } = await supabase
          .from('stamp_records')
          .select('participant_id')
          .eq('center_id', centerId)
        filterIds = Array.from(
          new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
        )
      }

      // 2. profiles 전체 fetch
      let pq = supabase
        .from('profiles')
        .select('id, name, phone, birthdate, created_at')
        .order('created_at', { ascending: false })
      if (filterIds !== null) {
        if (filterIds.length === 0) {
          alert('다운로드할 참가자가 없습니다')
          return
        }
        pq = pq.in('id', filterIds)
      }
      const { data: profiles } = await pq
      const profileList = profiles ?? []

      // 3. 스탬프 상세 fetch (centerId 있으면 해당 기관만)
      let sq = supabase
        .from('stamp_records')
        .select('participant_id, participant_name, participant_phone, center_id, center_name, approved_by, stamped_at')
        .order('stamped_at', { ascending: false })
      if (centerId !== null && centerId !== undefined) sq = sq.eq('center_id', centerId)
      const { data: stamps } = await sq
      const stampList = stamps ?? []

      // 4. 총 스탬프 수 계산용 (전체 17개 기관 기준 — distinct center_id)
      const ids = profileList.map(p => p.id)
      const { data: countData } = ids.length > 0
        ? await supabase
            .from('stamp_records')
            .select('participant_id, center_id')
            .in('participant_id', ids)
        : { data: [] }
      const orgsByPid: Record<string, Set<number>> = {}
      ;(countData ?? []).forEach((s: any) => {
        if (!s.participant_id) return
        if (!orgsByPid[s.participant_id]) orgsByPid[s.participant_id] = new Set()
        orgsByPid[s.participant_id].add(s.center_id)
      })

      // 5. Sheet1 — 참가자 목록
      const sheet1Rows = profileList.map((p, idx) => {
        const orgCount = orgsByPid[p.id]?.size ?? 0
        return {
          '번호': idx + 1,
          '이름': p.name,
          '전화번호': formatPhone(p.phone),
          '생년월일': formatBirthdate(p.birthdate),
          '가입일': formatDate(p.created_at),
          '총 스탬프 수': orgCount,
          '완주여부': orgCount >= 17 ? 'O' : '',
        }
      })

      // 6. Sheet2 — 스탬프 상세 기록
      const sheet2Rows = stampList.map((s: any, idx: number) => ({
        '번호': idx + 1,
        '참가자명': s.participant_name ?? '',
        '전화번호': formatPhone(s.participant_phone ?? ''),
        '기관명': s.center_name ?? '',
        '스탬프 날짜': s.stamped_at ? formatDate(s.stamped_at) : '',
        '승인한 관리자': s.approved_by ?? '',
      }))

      // 7. 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws1 = XLSX.utils.json_to_sheet(
        sheet1Rows.length > 0 ? sheet1Rows : [{ '안내': '데이터 없음' }]
      )
      const ws2 = XLSX.utils.json_to_sheet(
        sheet2Rows.length > 0 ? sheet2Rows : [{ '안내': '데이터 없음' }]
      )
      ws1['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
      ws2['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, '참가자 목록')
      XLSX.utils.book_append_sheet(wb, ws2, '스탬프 상세')

      // 8. 파일명
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const orgSuffix = centerId !== null && centerId !== undefined
        ? `_${ORGANIZATIONS.find(o => o.id === centerId)?.name ?? ''}`
        : ''
      const fileName = `BYCT_참가자현황${orgSuffix}_${yyyy}${mm}${dd}.xlsx`

      XLSX.writeFile(wb, fileName)
    } catch (e: any) {
      alert('다운로드 실패: ' + (e.message ?? ''))
    } finally {
      setExporting(false)
    }
  }

  // ── 스탬프 찍기 ──────────────────────────────────────────────────────────

  async function checkDuplicate(profileId: string, orgId: number) {
    const { data } = await supabase
      .from('stamp_records')
      .select('id, stamped_at')
      .eq('participant_id', profileId)
      .eq('center_id', orgId)
      .maybeSingle()
    setAlreadyStamped(!!data)
    setExistingStampId(data?.id ?? null)
    setExistingStampDate(data?.stamped_at ?? null)
  }

  function resetStampStatus() {
    setAlreadyStamped(false)
    setExistingStampId(null)
    setExistingStampDate(null)
    setStampSuccess(false)
    setCancelSuccess(false)
  }

  async function handleSearch() {
    if (!searchPhone || !admin) return
    setSearching(true)
    setSearchError('')
    setFoundProfile(null)
    resetStampStatus()
    try {
      const raw = searchPhone.replace(/\D/g, '')
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, phone, birthdate')
        .eq('phone', raw)
        .maybeSingle()
      if (error) throw error
      if (!profile) { setSearchError('해당 전화번호로 등록된 참여자가 없습니다'); return }
      setFoundProfile(profile)
      if (admin.role === 'center' && admin.center_id) await checkDuplicate(profile.id, admin.center_id)
      if (admin.role === 'super' && selectedOrgId) await checkDuplicate(profile.id, selectedOrgId)
    } catch (e: any) {
      setSearchError(e.message ?? '오류가 발생했습니다')
    } finally {
      setSearching(false)
    }
  }

  async function handleOrgSelect(orgId: number) {
    setSelectedOrgId(orgId)
    resetStampStatus()
    if (foundProfile) await checkDuplicate(foundProfile.id, orgId)
  }

  async function handleStamp() {
    if (!admin || !foundProfile || !selectedOrgId) return
    const org = ORGANIZATIONS.find(o => o.id === selectedOrgId)
    if (!org) return
    setStamping(true)
    setSearchError('')
    try {
      const { data: inserted, error } = await supabase.from('stamp_records').insert({
        participant_id: foundProfile.id,
        participant_name: foundProfile.name,
        participant_phone: foundProfile.phone,
        center_id: selectedOrgId,
        center_name: org.name,
        approved_by: admin.name,
      }).select('id, stamped_at').single()
      if (error) throw error
      setAlreadyStamped(true)
      setStampSuccess(true)
      setCancelSuccess(false)
      setExistingStampId(inserted?.id ?? null)
      setExistingStampDate(inserted?.stamped_at ?? null)
    } catch (e: any) {
      setSearchError(e.message ?? '스탬프 발급에 실패했습니다')
    } finally {
      setStamping(false)
    }
  }

  async function handleCancelStamp() {
    if (!existingStampId || !foundProfile) return
    if (!confirm('이 스탬프를 취소하시겠습니까?\n참가자에게 발급된 스탬프 기록이 삭제됩니다.')) return
    setCancelling(true)
    setSearchError('')
    try {
      const { error } = await supabase.from('stamp_records').delete().eq('id', existingStampId)
      if (error) throw error
      setAlreadyStamped(false)
      setExistingStampId(null)
      setExistingStampDate(null)
      setStampSuccess(false)
      setCancelSuccess(true)
    } catch (e: any) {
      setSearchError('취소 실패: ' + (e.message ?? ''))
    } finally {
      setCancelling(false)
    }
  }

  async function handleCancelSearch() {
    if (!cancelSearchPhone || !admin) return
    const orgId = admin.role === 'center' ? admin.center_id : selectedOrgId
    if (!orgId) {
      setCancelSearchError(admin.role === 'super' ? '먼저 발급 기관을 선택해주세요' : '기관 정보가 없습니다')
      return
    }
    setCancelSearching(true)
    setCancelSearchError('')
    setCancelTarget(null)
    setCancelDoneMsg(false)
    try {
      const raw = cancelSearchPhone.replace(/\D/g, '')
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, phone, birthdate')
        .eq('phone', raw)
        .maybeSingle()
      if (pErr) throw pErr
      if (!profile) { setCancelSearchError('해당 전화번호로 등록된 참여자가 없습니다'); return }

      const { data: stamp, error: sErr } = await supabase
        .from('stamp_records')
        .select('id, stamped_at')
        .eq('participant_id', profile.id)
        .eq('center_id', orgId)
        .maybeSingle()
      if (sErr) throw sErr
      if (!stamp) { setCancelSearchError('해당 기관에서 발급된 스탬프가 없습니다'); return }

      setCancelTarget({
        stampId: stamp.id,
        stampedAt: stamp.stamped_at,
        name: profile.name,
        phone: profile.phone,
        birthdate: profile.birthdate ?? '',
      })
    } catch (e: any) {
      setCancelSearchError(e.message ?? '오류가 발생했습니다')
    } finally {
      setCancelSearching(false)
    }
  }

  async function handleCancelTargetExecute() {
    if (!cancelTarget) return
    if (!confirm(`"${cancelTarget.name}" 참가자의 스탬프를 취소하시겠습니까?\n발급된 스탬프 기록이 삭제됩니다.`)) return
    setCancelProcessing(true)
    try {
      const { error } = await supabase.from('stamp_records').delete().eq('id', cancelTarget.stampId)
      if (error) throw error
      setCancelTarget(null)
      setCancelSearchPhone('')
      setCancelDoneMsg(true)
    } catch (e: any) {
      alert('취소 실패: ' + (e.message ?? ''))
    } finally {
      setCancelProcessing(false)
    }
  }

  // ── 관리자 관리 ──────────────────────────────────────────────────────────

  async function loadAdmins() {
    setAdminsLoading(true)
    const { data } = await supabase.from('admins').select('id, name, phone, role, center_id, center_name').order('role')
    setAdmins(data ?? [])
    setAdminsLoading(false)
  }

  async function handleAddAdmin() {
    setAdminError('')
    const { name, phone, password, role, center_id } = newAdmin
    if (!name || !phone || !password) { setAdminError('이름, 전화번호, 비밀번호를 입력해주세요'); return }
    if (role === 'center' && !center_id) { setAdminError('기관을 선택해주세요'); return }
    setAddingAdmin(true)
    try {
      const raw = phone.replace(/\D/g, '')
      const org = ORGANIZATIONS.find(o => o.id === Number(center_id))
      const { error } = await supabase.from('admins').insert({
        name, phone: raw, password, role,
        center_id: role === 'center' ? Number(center_id) : null,
        center_name: role === 'center' ? (org?.name ?? '') : null,
      })
      if (error) throw error
      setNewAdmin({ name: '', phone: '', password: '', role: 'center', center_id: '' })
      loadAdmins()
    } catch (e: any) {
      setAdminError(e.message ?? '추가에 실패했습니다')
    } finally {
      setAddingAdmin(false)
    }
  }

  async function handleDeleteAdmin(id: string) {
    if (!confirm('이 관리자를 삭제할까요?')) return
    await supabase.from('admins').delete().eq('id', id)
    loadAdmins()
  }

  // ── 기관 링크 ────────────────────────────────────────────────────────────

  async function loadCenterLinks() {
    setLinksLoading(true)
    try {
      const { data } = await supabase.from('centers').select('id, program_url')
      const map: Record<number, string> = {}
      ORGANIZATIONS.forEach(o => { map[o.id] = '' })
      ;(data ?? []).forEach((c: any) => {
        if (c.program_url) map[c.id] = c.program_url
      })
      setLinkUrls(map)
    } finally {
      setLinksLoading(false)
    }
  }

  async function saveCenterLink(orgId: number) {
    if (!admin) return
    if (admin.role === 'center' && admin.center_id !== orgId) return
    setSavingLinkId(orgId)
    setSavedLinkId(null)
    try {
      const url = (linkUrls[orgId] ?? '').trim()
      const org = ORGANIZATIONS.find(o => o.id === orgId)
      const { error } = await supabase.from('centers').upsert({
        id: orgId,
        name: org?.name ?? '',
        program_url: url || null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setSavedLinkId(orgId)
      setTimeout(() => setSavedLinkId(curr => (curr === orgId ? null : curr)), 1500)
    } catch (e: any) {
      alert('저장 실패: ' + (e.message ?? ''))
    } finally {
      setSavingLinkId(null)
    }
  }

  // ── 평가 ──────────────────────────────────────────────────────────────────

  const loadReviews = useCallback(async (centerId: number | null) => {
    setReviewsLoading(true)
    try {
      let query = supabase
        .from('reviews')
        .select('id, participant_id, participant_name, center_id, center_name, rating, comment, created_at')
        .order('created_at', { ascending: false })
      if (centerId !== null) query = query.eq('center_id', centerId)
      const { data } = await query
      setReviews((data ?? []) as ReviewRow[])
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  async function handleDeleteReview(id: string) {
    if (admin?.role !== 'super') return
    if (!confirm('이 평가를 삭제할까요?')) return
    setDeletingReviewId(id)
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
      setReviews(prev => prev.filter(r => r.id !== id))
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '삭제에 실패했습니다. 다시 시도해주세요.'
      )
    } finally {
      setDeletingReviewId(null)
    }
  }

  // ── 신청 대기 ────────────────────────────────────────────────────────────

  const loadApplications = useCallback(async (centerId: number | null) => {
    if (!admin) return
    setApplicationsLoading(true)
    try {
      // 기관관리자는 본인 기관으로 강제
      const effectiveCenterId = admin.role === 'center' ? (admin.center_id ?? null) : centerId
      if (admin.role === 'center' && !admin.center_id) {
        setApplications([])
        return
      }

      let q = supabase
        .from('applications')
        .select('id, participant_id, participant_name, participant_phone, center_id, center_name, status, applied_at')
        .eq('status', 'pending')
        .order('applied_at', { ascending: true })
      if (effectiveCenterId !== null) q = q.eq('center_id', effectiveCenterId)

      const { data } = await q
      setApplications((data ?? []) as ApplicationRow[])
    } finally {
      setApplicationsLoading(false)
    }
  }, [admin])

  const loadPendingCount = useCallback(async () => {
    if (!admin) return
    try {
      let q = supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (admin.role === 'center') {
        if (!admin.center_id) { setPendingCount(0); return }
        q = q.eq('center_id', admin.center_id)
      }
      const { count } = await q
      setPendingCount(count ?? 0)
    } catch {
      // 카운트 실패는 조용히 무시 (배지가 0으로 표시됨)
    }
  }, [admin])

  async function handleApproveApplication(app: ApplicationRow) {
    if (!admin) return
    if (admin.role === 'center' && admin.center_id !== app.center_id) return
    setProcessingAppId(app.id)
    try {
      // 1. 이미 스탬프가 있는지 확인
      const { data: existing } = await supabase
        .from('stamp_records')
        .select('id')
        .eq('participant_id', app.participant_id)
        .eq('center_id', app.center_id)
        .maybeSingle()

      // 2. 없으면 스탬프 발급
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

      // 3. 신청 상태를 approved로 변경
      const { error: updErr } = await supabase
        .from('applications')
        .update({ status: 'approved' })
        .eq('id', app.id)
      if (updErr) throw updErr

      setApplications(prev => prev.filter(a => a.id !== app.id))
      setPendingCount(c => Math.max(0, c - 1))
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

  async function handleRejectApplication(app: ApplicationRow) {
    if (admin?.role !== 'super' && (admin?.role !== 'center' || admin.center_id !== app.center_id)) return
    if (!confirm(`"${app.participant_name}" 님의 신청을 삭제할까요?`)) return
    setProcessingAppId(app.id)
    try {
      const { error } = await supabase.from('applications').delete().eq('id', app.id)
      if (error) throw error
      setApplications(prev => prev.filter(a => a.id !== app.id))
      setPendingCount(c => Math.max(0, c - 1))
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase()
      alert(
        msg.includes('failed to fetch') || msg.includes('network')
          ? '네트워크 오류가 발생했습니다.'
          : '삭제에 실패했습니다. 다시 시도해주세요.',
      )
    } finally {
      setProcessingAppId(null)
    }
  }

  // ── 탭 전환 시 데이터 로드 (admin 인증 완료 후 실행) ──────────────────────

  useEffect(() => {
    if (loading || !admin) return
    if (tab === 'dashboard') { loadStats(); loadDashParticipants(0); loadRanking(); setDashPage(0) }
    if (tab === 'participants') { loadParticipants(0, '', pCenterId); setPPage(0); setPSearch('') }
    if (tab === 'admins' && admin.role === 'super') loadAdmins()
    if (tab === 'links') loadCenterLinks()
    if (tab === 'reviews') {
      const initial = admin.role === 'center' ? (admin.center_id ?? null) : reviewCenterId
      setReviewCenterId(initial)
      loadReviews(initial)
    }
    if (tab === 'applications') {
      const initial = admin.role === 'center' ? (admin.center_id ?? null) : applicationCenterId
      setApplicationCenterId(initial)
      loadApplications(initial)
      loadPendingCount()
    }
    if (tab === 'programs') loadPrograms()
  }, [tab, admin, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // 인증 직후 대기 인원 카운트 로드 (탭 배지용)
  useEffect(() => {
    if (loading || !admin) return
    loadPendingCount()
  }, [admin, loading, loadPendingCount])

  useEffect(() => {
    if (loading || !admin || tab !== 'reviews') return
    loadReviews(reviewCenterId)
  }, [reviewCenterId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !admin || tab !== 'applications') return
    loadApplications(applicationCenterId)
  }, [applicationCenterId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !admin || tab !== 'dashboard') return
    const id = setInterval(() => loadRanking(), 30000)
    return () => clearInterval(id)
  }, [tab, admin, loading, loadRanking])

  useEffect(() => {
    if (tab === 'dashboard') loadDashParticipants(dashPage)
  }, [dashPage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'participants') loadParticipants(pPage, pSearch, pCenterId)
  }, [pPage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !admin || tab !== 'participants') return
    setPPage(0)
    setPSearch('')
    loadParticipants(0, '', pCenterId)
  }, [pCenterId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    ...(admin.role === 'super' ? [{ key: 'admins' as Tab, label: '관리자 관리' }] : []),
  ]

  const dashTotalPages = Math.ceil(dashTotal / PAGE_SIZE)
  const pTotalPages = Math.ceil(pTotal / PAGE_SIZE)

  return (
    <div className="py-5">
      {/* 헤더 */}
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

      {/* 탭 — 2행 그리드 (한 줄에 4개) */}
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

      {/* ══════════════════════════════════════════════════════════════════
          대시보드 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
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
      )}

      {/* ══════════════════════════════════════════════════════════════════
          스탬프 찍기 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'stamp' && (
        <div className="px-4 space-y-4">
          {!admin.center_id && admin.role !== 'super' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-sm text-amber-700 font-semibold">기관이 지정되지 않은 관리자입니다.</p>
              <p className="text-xs text-amber-600 mt-1">슈퍼관리자에게 기관 배정을 요청하세요.</p>
            </div>
          ) : (
            <>
              {admin.role === 'super' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">발급 기관 선택</label>
                  <select
                    value={selectedOrgId ?? ''}
                    onChange={e => handleOrgSelect(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                  >
                    <option value="">기관을 선택하세요</option>
                    {ORGANIZATIONS.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {admin.role === 'center' && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                  <p className="text-xs text-blue-700 font-semibold">발급 기관: {admin.center_name}</p>
                  <p className="text-xs text-blue-500 mt-0.5">참여자의 전화번호로 검색 후 스탬프를 발급하세요.</p>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  <Phone size={13} className="inline mr-1" /> 참여자 전화번호
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel" inputMode="numeric"
                    value={searchPhone}
                    onChange={e => { setSearchPhone(formatPhone(e.target.value)); setSearchError(''); setFoundProfile(null); resetStampStatus() }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="010-1234-5678"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 tracking-wider"
                  />
                  <button onClick={handleSearch} disabled={searching || !searchPhone} className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
                    {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                {searchError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <XCircle size={15} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{searchError}</p>
                  </div>
                )}
              </div>

              {foundProfile && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <UserCheck size={16} className="text-gray-600" />
                    <p className="text-sm font-bold text-gray-900">참여자 확인</p>
                  </div>
                  <div className="px-5 py-4 space-y-2.5">
                    <div className="flex justify-between"><span className="text-xs text-gray-500">이름</span><span className="text-sm font-semibold text-gray-900">{foundProfile.name}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-500">전화번호</span><span className="text-sm text-gray-700">{formatPhone(foundProfile.phone)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-500">생년월일</span><span className="text-sm text-gray-700">{formatBirthdate(foundProfile.birthdate)}</span></div>
                    {selectedOrgId && (
                      <div className="flex justify-between"><span className="text-xs text-gray-500">발급 기관</span><span className="text-sm font-medium text-gray-800">{ORGANIZATIONS.find(o => o.id === selectedOrgId)?.name}</span></div>
                    )}
                  </div>
                  <div className="px-5 pb-5 space-y-2">
                    {!selectedOrgId ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">위에서 기관을 먼저 선택해주세요.</div>
                    ) : cancelSuccess ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-green-700">스탬프가 취소되었습니다.</p>
                      </div>
                    ) : stampSuccess ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-green-700">스탬프가 발급되었습니다!</p>
                      </div>
                    ) : alreadyStamped ? (
                      <>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-amber-500 flex-shrink-0" />
                            <p className="text-sm font-semibold text-amber-700">이미 스탬프가 발급된 참여자입니다.</p>
                          </div>
                          {existingStampDate && (
                            <p className="text-xs text-amber-600 mt-1 ml-7">발급일: {formatDate(existingStampDate)}</p>
                          )}
                        </div>
                        <button
                          onClick={handleCancelStamp}
                          disabled={cancelling}
                          className="w-full py-3.5 bg-red-50 text-red-600 border border-red-200 font-bold text-sm rounded-2xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Trash2 size={16} />
                          {cancelling ? '취소 중...' : '스탬프 취소'}
                        </button>
                      </>
                    ) : (
                      <button onClick={handleStamp} disabled={stamping} className="w-full py-4 bg-blue-600 text-white font-bold text-base rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        <Stamp size={18} />
                        {stamping ? '발급 중...' : '스탬프 발급'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── 스탬프 취소 섹션 ────────────────────────────────────── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Trash2 size={14} className="text-red-500" /> 스탬프 취소
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {admin.role === 'center'
                      ? `${admin.center_name ?? '본인 기관'}에서 발급된 스탬프만 취소할 수 있습니다.`
                      : '선택한 기관의 스탬프 기록을 취소합니다.'}
                  </p>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="tel" inputMode="numeric"
                      value={cancelSearchPhone}
                      onChange={e => {
                        setCancelSearchPhone(formatPhone(e.target.value))
                        setCancelSearchError('')
                        setCancelTarget(null)
                        setCancelDoneMsg(false)
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleCancelSearch()}
                      placeholder="010-1234-5678"
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 tracking-wider"
                    />
                    <button
                      onClick={handleCancelSearch}
                      disabled={cancelSearching || !cancelSearchPhone}
                      className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {cancelSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </div>

                  {cancelSearchError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <XCircle size={15} className="text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600">{cancelSearchError}</p>
                    </div>
                  )}

                  {cancelDoneMsg && !cancelTarget && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-green-700">스탬프가 취소되었습니다.</p>
                    </div>
                  )}

                  {cancelTarget && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 space-y-2 bg-amber-50/40">
                        <div className="flex justify-between"><span className="text-xs text-gray-500">이름</span><span className="text-sm font-semibold text-gray-900">{cancelTarget.name}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-gray-500">전화번호</span><span className="text-sm text-gray-700">{formatPhone(cancelTarget.phone)}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-gray-500">생년월일</span><span className="text-sm text-gray-700">{formatBirthdate(cancelTarget.birthdate)}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-gray-500">스탬프 발급일</span><span className="text-sm text-gray-700">{formatDate(cancelTarget.stampedAt)}</span></div>
                      </div>
                      <button
                        onClick={handleCancelTargetExecute}
                        disabled={cancelProcessing}
                        className="w-full py-3.5 bg-red-600 text-white font-bold text-sm hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} />
                        {cancelProcessing ? '취소 중...' : '스탬프 취소'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          참가자 관리 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'participants' && (
        <div className="px-4 space-y-4">
          {/* 권한 안내 */}
          {admin.role === 'center' && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에서 스탬프를 받은 참가자만 조회됩니다.
              </p>
              <p className="text-xs text-blue-600 mt-0.5">조회 전용 — 수정/삭제는 슈퍼관리자만 가능합니다.</p>
            </div>
          )}

          {/* 기관 필터 (슈퍼관리자만) */}
          {admin.role === 'super' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 필터</label>
              <select
                value={pCenterId ?? ''}
                onChange={e => {
                  const v = e.target.value
                  setPCenterId(v === '' ? null : Number(v))
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              >
                <option value="">전체 참가자</option>
                {ORGANIZATIONS.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 검색 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={pSearch}
              onChange={e => setPSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPPage(0); loadParticipants(0, pSearch, pCenterId) } }}
              placeholder="이름 또는 전화번호 검색"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <button
              onClick={() => { setPPage(0); loadParticipants(0, pSearch, pCenterId) }}
              className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Search size={16} />
            </button>
            {pSearch && (
              <button
                onClick={() => { setPSearch(''); setPPage(0); loadParticipants(0, '', pCenterId) }}
                className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* 엑셀 다운로드 */}
          <div className="flex justify-end">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {exporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              {exporting ? '다운로드 중...' : '엑셀 다운로드'}
            </button>
          </div>

          {/* 참가자 목록 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 min-w-0">
                <Users size={15} className="flex-shrink-0" />
                <span className="truncate">
                  {pCenterId === null
                    ? '전체 참가자'
                    : `${ORGANIZATIONS.find(o => o.id === pCenterId)?.name ?? ''} 참가자`}
                </span>
                {!pLoading && <span className="text-xs text-gray-400 font-normal flex-shrink-0">{pTotal}명</span>}
              </h2>
              <button onClick={() => loadParticipants(pPage, pSearch, pCenterId)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={13} className={pLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {pLoading ? (
              <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
            ) : pList.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {pSearch
                  ? '검색 결과가 없습니다'
                  : pCenterId !== null
                    ? '해당 기관에서 스탬프를 받은 참가자가 없습니다'
                    : '등록된 참가자가 없습니다'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pList.map(p => (
                  <div key={p.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                          {admin.role === 'super' && (
                            <button
                              onClick={() => { setEditId(p.id); setEditForm({ name: p.name, phone: formatPhone(p.phone), birthdate: p.birthdate ?? '' }); setSaveError(''); setExpandedPId(null) }}
                              className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="수정"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          <span className="text-xs font-bold text-blue-600 flex-shrink-0 ml-auto">
                            {p.stampCount}<span className="font-normal text-gray-400">/17</span>
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatPhone(p.phone)} · {formatBirthdate(p.birthdate)} · {formatDate(p.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {admin.role === 'super' && (
                          <button
                            onClick={() => handleDeleteParticipant(p)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (expandedPId === p.id) { setExpandedPId(null); return }
                            setExpandedPId(p.id)
                            await loadParticipantStamps(p.id)
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="스탬프 기록"
                        >
                          {expandedPId === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* 스탬프 기록 펼침 */}
                    {expandedPId === p.id && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        {pStampsLoading ? (
                          <div className="py-3 flex justify-center"><RefreshCw size={14} className="animate-spin text-gray-300" /></div>
                        ) : pStamps.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">스탬프 기록이 없습니다</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 mb-2">스탬프 기록 ({pStamps.length}개)</p>
                            {pStamps.map(sr => {
                              const org = ORGANIZATIONS.find(o => o.id === sr.center_id)
                              return (
                                <div key={sr.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                  {org && <OrgIcon org={org} size={28} rounded="rounded-lg" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-800 truncate">{sr.center_name}</p>
                                    <p className="text-xs text-gray-400">{formatDate(sr.stamped_at)} · {sr.approved_by}</p>
                                  </div>
                                  {admin.role === 'super' && (
                                    <button
                                      onClick={() => handleDeleteStamp(sr.id)}
                                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                      title="스탬프 삭제"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {pTotalPages > 1 && !pLoading && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
                <button onClick={() => setPPage(p => Math.max(0, p - 1))} disabled={pPage === 0} className="flex items-center gap-1 text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors">
                  <ChevronLeft size={14} /> 이전
                </button>
                <span className="text-xs text-gray-500">{pPage + 1} / {pTotalPages}</span>
                <button onClick={() => setPPage(p => Math.min(pTotalPages - 1, p + 1))} disabled={pPage >= pTotalPages - 1} className="flex items-center gap-1 text-xs text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors">
                  다음 <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          신청 대기 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'applications' && (
        <div className="px-4 space-y-4">
          {admin.role === 'center' && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에 신청한 참가자만 표시됩니다.
              </p>
              <p className="text-xs text-blue-600 mt-0.5">"스탬프 찍기"를 누르면 즉시 발급되고 승인완료로 변경됩니다.</p>
            </div>
          )}

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
                ⏳ 신청 대기 목록
                {!applicationsLoading && (
                  <span className="text-xs text-gray-400 font-normal">{applications.length}명</span>
                )}
              </h2>
              <button
                onClick={() => { loadApplications(applicationCenterId); loadPendingCount() }}
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
                <p className="text-sm text-gray-500 font-medium">대기 중인 신청이 없습니다</p>
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
                          <p className="text-xs text-gray-500 font-medium truncate">{app.center_name}</p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5">{app.participant_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatPhone(app.participant_phone)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            신청 {formatDate(app.applied_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleRejectApplication(app)}
                          disabled={processing}
                          className="px-3 py-2.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => handleApproveApplication(app)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {processing ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" /> 발급 중...
                            </>
                          ) : (
                            <>
                              <Stamp size={14} /> 스탬프 찍기
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          평가 모아보기 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'reviews' && (() => {
        const visibleCenterId = admin.role === 'center' ? admin.center_id : reviewCenterId
        const filtered = visibleCenterId !== null && visibleCenterId !== undefined
          ? reviews.filter(r => r.center_id === visibleCenterId)
          : reviews

        const summaryMap: Record<number, { name: string; total: number; sum: number }> = {}
        reviews.forEach(r => {
          if (!summaryMap[r.center_id]) summaryMap[r.center_id] = { name: r.center_name, total: 0, sum: 0 }
          summaryMap[r.center_id].total += 1
          summaryMap[r.center_id].sum += r.rating
        })
        const summary: ReviewSummary[] = ORGANIZATIONS
          .filter(o => admin.role === 'super' || admin.center_id === o.id)
          .map(o => {
            const s = summaryMap[o.id]
            return {
              center_id: o.id,
              center_name: o.name,
              count: s?.total ?? 0,
              avg: s ? Math.round((s.sum / s.total) * 10) / 10 : 0,
            }
          })
          .sort((a, b) => b.avg - a.avg || b.count - a.count)

        const overallCount = filtered.length
        const overallAvg = overallCount > 0
          ? Math.round((filtered.reduce((acc, r) => acc + r.rating, 0) / overallCount) * 10) / 10
          : 0

        return (
          <div className="px-4 space-y-4">
            {admin.role === 'center' && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>에 작성된 평가만 조회됩니다.
                </p>
              </div>
            )}

            {/* 기관 필터 (슈퍼관리자만) */}
            {admin.role === 'super' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">기관 필터</label>
                <select
                  value={reviewCenterId ?? ''}
                  onChange={e => {
                    const v = e.target.value
                    setReviewCenterId(v === '' ? null : Number(v))
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

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-500 rounded-2xl p-4 text-white">
                <Star size={20} className="mb-2 opacity-90 fill-white" />
                <p className="text-3xl font-black">
                  {overallAvg > 0 ? overallAvg.toFixed(1) : '-'}
                </p>
                <p className="text-sm text-amber-100 mt-0.5">평균 별점</p>
              </div>
              <div className="bg-rose-500 rounded-2xl p-4 text-white">
                <Users size={20} className="mb-2 opacity-90" />
                <p className="text-3xl font-black">{overallCount}</p>
                <p className="text-sm text-rose-100 mt-0.5">평가 수</p>
              </div>
            </div>

            {/* 기관별 평균 별점 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <BarChart3 size={15} /> 기관별 평균 별점
                </h2>
                <button onClick={() => loadReviews(reviewCenterId)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <RefreshCw size={13} className={reviewsLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {summary.map(({ center_id, center_name, count, avg }, idx) => {
                  const org = ORGANIZATIONS.find(o => o.id === center_id)
                  return (
                    <button
                      key={center_id}
                      type="button"
                      onClick={() => admin.role === 'super' && setReviewCenterId(center_id)}
                      disabled={admin.role !== 'super'}
                      className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                        admin.role === 'super' ? 'hover:bg-gray-50' : ''
                      } ${reviewCenterId === center_id ? 'bg-amber-50' : ''}`}
                    >
                      <span className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</span>
                      {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{center_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star
                                key={n}
                                size={11}
                                strokeWidth={1.5}
                                className={n <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">{count}건</span>
                        </div>
                      </div>
                      <p className="text-base font-black text-amber-500 flex-shrink-0">
                        {avg > 0 ? avg.toFixed(1) : '-'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 한줄평 목록 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  💬 한줄평 목록
                  {!reviewsLoading && (
                    <span className="text-xs text-gray-400 font-normal">{filtered.length}건</span>
                  )}
                </h2>
                {admin.role === 'super' && reviewCenterId !== null && (
                  <button
                    onClick={() => setReviewCenterId(null)}
                    className="text-xs text-blue-600 font-semibold hover:text-blue-700"
                  >
                    전체 보기
                  </button>
                )}
              </div>

              {reviewsLoading ? (
                <div className="py-10 flex justify-center">
                  <RefreshCw size={18} className="animate-spin text-gray-300" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">아직 작성된 평가가 없습니다</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const org = ORGANIZATIONS.find(o => o.id === r.center_id)
                    return (
                      <div key={r.id} className="px-5 py-3.5">
                        <div className="flex items-start gap-2.5">
                          {org && <OrgIcon org={org} size={32} rounded="rounded-lg" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-gray-700 truncate">{r.center_name}</p>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map(n => (
                                  <Star
                                    key={n}
                                    size={11}
                                    strokeWidth={1.5}
                                    className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                                  />
                                ))}
                                <span className="text-xs font-bold text-amber-600 ml-1">{r.rating}</span>
                              </div>
                            </div>
                            {r.comment && (
                              <p className="text-sm text-gray-800 mt-1.5 leading-relaxed">"{r.comment}"</p>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <p className="text-xs text-gray-400">
                                {r.participant_name} · {formatDate(r.created_at)}
                              </p>
                              {admin.role === 'super' && (
                                <button
                                  onClick={() => handleDeleteReview(r.id)}
                                  disabled={deletingReviewId === r.id}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="평가 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          기관 링크 관리 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'links' && (
        <div className="px-4 space-y-4">
          {admin.role === 'center' && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>의 신청 링크만 수정할 수 있습니다.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Link2 size={15} /> 프로그램 신청 링크
              </h2>
              <button onClick={loadCenterLinks} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={13} className={linksLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {linksLoading ? (
              <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {ORGANIZATIONS
                  .filter(org => admin.role === 'super' || admin.center_id === org.id)
                  .map(org => {
                    const editable = admin.role === 'super' || admin.center_id === org.id
                    const url = linkUrls[org.id] ?? ''
                    const saving = savingLinkId === org.id
                    const justSaved = savedLinkId === org.id
                    return (
                      <div key={org.id} className="px-5 py-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <OrgIcon org={org} size={28} rounded="rounded-lg" />
                          <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{org.name}</p>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                              title="링크 열기"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={url}
                            onChange={e => setLinkUrls(prev => ({ ...prev, [org.id]: e.target.value }))}
                            placeholder="https://..."
                            disabled={!editable}
                            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          {editable && (
                            <button
                              onClick={() => saveCenterLink(org.id)}
                              disabled={saving}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${
                                justSaved
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95'
                              }`}
                            >
                              {saving
                                ? <RefreshCw size={12} className="animate-spin" />
                                : justSaved
                                  ? <CheckCircle size={12} />
                                  : <Save size={12} />}
                              {saving ? '저장 중' : justSaved ? '저장됨' : '저장'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center px-2">
            저장된 링크는 참가자 화면의 "프로그램 신청하기" 버튼에 사용됩니다.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          관리자 관리 탭 (super only)
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'admins' && admin.role === 'super' && (
        <div className="px-4 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Plus size={15} /> 관리자 추가</h2>
            <input type="text" value={newAdmin.name} onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))} placeholder="이름" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
            <input type="tel" inputMode="numeric" value={newAdmin.phone} onChange={e => setNewAdmin(p => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="전화번호" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-gray-800" />
            <input type="password" value={newAdmin.password} onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))} placeholder="비밀번호" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
            <select value={newAdmin.role} onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value as 'super' | 'center', center_id: '' }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
              <option value="center">센터관리자</option>
              <option value="super">슈퍼관리자</option>
            </select>
            {newAdmin.role === 'center' && (
              <select value={newAdmin.center_id} onChange={e => setNewAdmin(p => ({ ...p, center_id: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
                <option value="">기관 선택</option>
                {ORGANIZATIONS.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            )}
            {adminError && <p className="text-xs text-red-500">{adminError}</p>}
            <button onClick={handleAddAdmin} disabled={addingAdmin} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
              {addingAdmin ? '추가 중...' : '관리자 추가'}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Shield size={15} /> 관리자 목록</h2>
              <button onClick={loadAdmins} className="text-gray-400 hover:text-gray-600 transition-colors"><RefreshCw size={13} /></button>
            </div>
            {adminsLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : admins.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">등록된 관리자가 없습니다</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {admins.map(a => (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.role === 'super' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {a.role === 'super' ? '슈퍼' : '센터'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatPhone(a.phone)}{a.center_name ? ` · ${a.center_name}` : ''}</p>
                    </div>
                    {a.id !== admin.id && (
                      <button onClick={() => handleDeleteAdmin(a.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          프로그램 관리 탭
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'programs' && (
        <div className="px-4 space-y-4">
          {admin.role === 'center' && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>의 프로그램만 수정할 수 있습니다.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Edit2 size={15} /> 프로그램 목록
              </h2>
              <button onClick={loadPrograms} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw size={13} className={programsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {programsLoading ? (
              <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {ORGANIZATIONS
                  .filter(org => admin.role === 'super' || admin.center_id === org.id)
                  .map(org => {
                    const orgPrograms = programs.filter(p => p.organization_id === org.id)
                    const editable = admin.role === 'super' || admin.center_id === org.id
                    return (
                      <div key={org.id} className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-3">
                          <OrgIcon org={org} size={28} rounded="rounded-lg" />
                          <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{org.name}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0">{orgPrograms.length}개</span>
                        </div>

                        {orgPrograms.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2 pl-9">등록된 프로그램이 없습니다</p>
                        ) : (
                          <div className="space-y-2 pl-9">
                            {orgPrograms.map(program => (
                              <div key={program.id} className="bg-gray-50 rounded-xl p-3 flex gap-3">
                                {program.image_url && (
                                  <img
                                    src={program.image_url}
                                    alt={program.name}
                                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{program.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    {program.date} · {program.time}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    정원 {program.capacity}명 · {program.target}
                                  </p>
                                </div>
                                {editable && (
                                  <button
                                    onClick={() => setEditingProgram(program)}
                                    className="self-start flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex-shrink-0"
                                  >
                                    <Edit2 size={11} /> 수정
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center px-2">
            수정한 내용은 참가자 화면의 프로그램 목록에 즉시 반영됩니다.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          프로그램 수정 모달
      ══════════════════════════════════════════════════════════════════ */}
      {editingProgram && (
        <ProgramEditModal
          program={editingProgram}
          ownerOrgId={editingProgram.organization_id}
          onClose={() => setEditingProgram(null)}
          onSaved={updated => {
            setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          참가자 정보 수정 모달 (super only)
      ══════════════════════════════════════════════════════════════════ */}
      {editId && admin.role === 'super' && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { if (!saving) { setEditId(null); setSaveError('') } }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Edit2 size={15} /> 참가자 정보 수정
              </h3>
              <button
                onClick={() => { if (!saving) { setEditId(null); setSaveError('') } }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="이름"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">전화번호</label>
                <input
                  type="tel" inputMode="numeric"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">생년월일</label>
                <input
                  type="text" inputMode="numeric"
                  value={editForm.birthdate}
                  onChange={e => setEditForm(f => ({ ...f, birthdate: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="20010101"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>
              {saveError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{saveError}</p>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => { setEditId(null); setSaveError('') }}
                disabled={saving}
                className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveParticipant}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save size={14} /> {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
