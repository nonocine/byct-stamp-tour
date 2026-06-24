import { supabase } from './supabase'
import { ORGANIZATIONS } from './data'

export interface ProgramSummary {
  id: string
  title: string
  date: string | null
  time: string | null
  capacity: number
  target: string
  hasPlanPdf: boolean
  planPdfUrl?: string | null
}

export interface AgeGroups {
  under10: number
  age10to13: number
  age14to16: number
  age17to19: number
  age20plus: number
  unknown: number
}

export interface CenterReportData {
  generatedAt: string
  organization: {
    id: number
    name: string
    location: string
    category: string
    description: string
  }
  programs: ProgramSummary[]
  applications: {
    total: number
    pending: number
    approved: number
    rejected: number
    waiting: number
  }
  stamps: {
    total: number
    uniqueParticipants: number
  }
  participation: {
    rate: number // 0–100, 승인 신청 대비 스탬프 발급률
  }
  ageGroups: AgeGroups
  satisfaction: {
    avg: number | null
    count: number
    programAvg: number | null
    leaderAvg: number | null
    facilityAvg: number | null
    comments: { rating: number; comment: string; name?: string }[]
    wishes: string[]
  }
  /** 담당지도자가 작성한 종합의견 (center_reports) */
  leaderOpinion: string | null
  timeline: {
    date: string
    applications: number
    stamps: number
  }[]
}

export interface CenterRanking {
  centerId: number
  name: string
  count: number
}
export interface CenterRatingRanking {
  centerId: number
  name: string
  avg: number
  count: number
}

export interface GlobalReportData {
  generatedAt: string
  totals: {
    organizations: number
    programs: number
    applications: number
    pending: number
    approved: number
    rejected: number
    waiting: number
    stamps: number
    uniqueParticipants: number
  }
  participation: { rate: number }
  satisfaction: {
    programAvg: number | null
    leaderAvg: number | null
    facilityAvg: number | null
    count: number
  }
  centerRankings: {
    byStamps: CenterRanking[]
    byRating: CenterRatingRanking[]
  }
  centerSummary: {
    centerId: number
    name: string
    programs: number
    approved: number
    stamps: number
    avgRating: number | null
  }[]
  ageGroups: AgeGroups
  latestGlobalPlan: {
    id: string
    title: string
    pdfUrl: string
    uploadedBy: string
    createdAt: string
  } | null
}

// ────────────────────────────────────────────────────────────────────────────

function countAgeGroups(birthdates: (string | null | undefined)[]): AgeGroups {
  const g: AgeGroups = {
    under10: 0,
    age10to13: 0,
    age14to16: 0,
    age17to19: 0,
    age20plus: 0,
    unknown: 0,
  }
  const cy = new Date().getFullYear()
  for (const bd of birthdates) {
    const d = (bd ?? '').replace(/\D/g, '')
    if (d.length < 4) {
      g.unknown++
      continue
    }
    const y = parseInt(d.slice(0, 4))
    if (!isFinite(y) || y < 1900 || y > cy) {
      g.unknown++
      continue
    }
    const age = cy - y
    if (age < 10) g.under10++
    else if (age <= 13) g.age10to13++
    else if (age <= 16) g.age14to16++
    else if (age <= 19) g.age17to19++
    else g.age20plus++
  }
  return g
}

function buildTimeline(apps: any[], stamps: any[]) {
  const byDate: Record<string, { apps: number; stamps: number }> = {}
  for (const a of apps) {
    const day = (a.applied_at ?? '').slice(0, 10)
    if (!day) continue
    if (!byDate[day]) byDate[day] = { apps: 0, stamps: 0 }
    byDate[day].apps++
  }
  for (const s of stamps) {
    const day = (s.stamped_at ?? '').slice(0, 10)
    if (!day) continue
    if (!byDate[day]) byDate[day] = { apps: 0, stamps: 0 }
    byDate[day].stamps++
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, v]) => ({ date, applications: v.apps, stamps: v.stamps }))
}

// ────────────────────────────────────────────────────────────────────────────

export async function collectCenterReportData(centerId: number): Promise<CenterReportData> {
  const org = ORGANIZATIONS.find(o => o.id === centerId)
  if (!org) throw new Error(`기관을 찾을 수 없습니다 (centerId=${centerId})`)

  const [progRes, appRes, stampRes, reviewRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, title, date, time, capacity, target, plan_pdf_url')
      .eq('organization_id', centerId)
      .order('date', { ascending: true }),
    supabase
      .from('applications')
      .select('id, status, applied_at, participant_id')
      .eq('center_id', centerId),
    supabase
      .from('stamp_records')
      .select('id, stamped_at, participant_id')
      .eq('center_id', centerId),
    supabase
      .from('reviews')
      .select('rating, comment, participant_name, program_rating, leader_rating, facility_rating, wish_program, created_at')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false }),
  ])

  // 담당지도자 종합의견 (테이블 미생성 등으로 실패해도 보고서 생성은 계속)
  let leaderOpinion: string | null = null
  try {
    const { data: opinionRow } = await supabase
      .from('center_reports')
      .select('opinion')
      .eq('center_id', centerId)
      .maybeSingle()
    leaderOpinion = (opinionRow?.opinion as string | undefined)?.trim() || null
  } catch {
    leaderOpinion = null
  }

  const programs: ProgramSummary[] = (progRes.data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    date: p.date ?? null,
    time: p.time ?? null,
    capacity: p.capacity ?? 0,
    target: p.target ?? '',
    hasPlanPdf: !!p.plan_pdf_url,
    planPdfUrl: p.plan_pdf_url ?? null,
  }))

  const apps = (appRes.data ?? []) as any[]
  const stamps = (stampRes.data ?? []) as any[]
  const reviews = (reviewRes.data ?? []) as any[]

  const applications = {
    total: apps.length,
    pending: apps.filter(a => a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    waiting: apps.filter(a => a.status === 'waiting').length,
  }

  const uniqueParticipants = new Set(
    stamps.map(s => s.participant_id).filter(Boolean) as string[],
  ).size

  const rate = applications.approved > 0
    ? (stamps.length / applications.approved) * 100
    : 0

  // 연령대 — 신청자/스탬프 받은 사람 전체의 birthdate 조회
  const participantIds = Array.from(
    new Set(
      [...apps.map(a => a.participant_id), ...stamps.map(s => s.participant_id)].filter(Boolean),
    ),
  ) as string[]
  let profiles: any[] = []
  if (participantIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, birthdate').in('id', participantIds)
    profiles = data ?? []
  }
  const ageGroups = countAgeGroups(profiles.map(p => p.birthdate))

  // 만족도
  const avgOf = (key: string): number | null => {
    const nums = reviews.map(r => r[key]).filter((n: any) => typeof n === 'number')
    if (nums.length === 0) return null
    return Math.round((nums.reduce((a: number, b: number) => a + b, 0) / nums.length) * 10) / 10
  }
  const avg = avgOf('rating')
  const programAvg = avgOf('program_rating')
  const leaderAvg = avgOf('leader_rating')
  const facilityAvg = avgOf('facility_rating')
  const comments = reviews
    .filter(r => r.comment && String(r.comment).trim())
    .slice(0, 20)
    .map(r => ({
      rating: r.rating,
      comment: r.comment as string,
      name: r.participant_name as string | undefined,
    }))
  const wishes = reviews
    .map(r => (r.wish_program ? String(r.wish_program).trim() : ''))
    .filter(Boolean)
    .slice(0, 20)

  return {
    generatedAt: new Date().toISOString(),
    organization: {
      id: org.id,
      name: org.name,
      location: org.location,
      category: org.category,
      description: org.description,
    },
    programs,
    applications,
    stamps: { total: stamps.length, uniqueParticipants },
    participation: { rate: Math.round(rate * 10) / 10 },
    ageGroups,
    satisfaction: {
      avg,
      count: reviews.length,
      programAvg,
      leaderAvg,
      facilityAvg,
      comments,
      wishes,
    },
    leaderOpinion,
    timeline: buildTimeline(apps, stamps),
  }
}

// ────────────────────────────────────────────────────────────────────────────

export async function collectGlobalReportData(): Promise<GlobalReportData> {
  const [progRes, appRes, stampRes, reviewRes, profRes, gpRes] = await Promise.all([
    supabase.from('programs').select('id, organization_id'),
    supabase.from('applications').select('id, status, center_id, participant_id'),
    supabase.from('stamp_records').select('id, center_id, participant_id'),
    supabase.from('reviews').select('center_id, rating, program_rating, leader_rating, facility_rating'),
    supabase.from('profiles').select('id, birthdate'),
    supabase
      .from('global_plans')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const programs = (progRes.data ?? []) as any[]
  const apps = (appRes.data ?? []) as any[]
  const stamps = (stampRes.data ?? []) as any[]
  const reviews = (reviewRes.data ?? []) as any[]
  const profiles = (profRes.data ?? []) as any[]
  const gp = gpRes.data ? (gpRes.data as any) : null

  const totals = {
    organizations: ORGANIZATIONS.length,
    programs: programs.length,
    applications: apps.length,
    pending: apps.filter(a => a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    waiting: apps.filter(a => a.status === 'waiting').length,
    stamps: stamps.length,
    uniqueParticipants: new Set(stamps.map(s => s.participant_id).filter(Boolean) as string[]).size,
  }

  const rate = totals.approved > 0 ? (totals.stamps / totals.approved) * 100 : 0

  const stampsByCenter = new Map<number, number>()
  for (const s of stamps) {
    if (typeof s.center_id !== 'number') continue
    stampsByCenter.set(s.center_id, (stampsByCenter.get(s.center_id) ?? 0) + 1)
  }
  const programsByCenter = new Map<number, number>()
  for (const p of programs) {
    if (typeof p.organization_id !== 'number') continue
    programsByCenter.set(p.organization_id, (programsByCenter.get(p.organization_id) ?? 0) + 1)
  }
  const approvedByCenter = new Map<number, number>()
  for (const a of apps) {
    if (a.status !== 'approved') continue
    if (typeof a.center_id !== 'number') continue
    approvedByCenter.set(a.center_id, (approvedByCenter.get(a.center_id) ?? 0) + 1)
  }
  const ratingsByCenter = new Map<number, number[]>()
  for (const r of reviews) {
    if (typeof r.center_id !== 'number') continue
    if (typeof r.rating !== 'number') continue
    const arr = ratingsByCenter.get(r.center_id) ?? []
    arr.push(r.rating)
    ratingsByCenter.set(r.center_id, arr)
  }

  const byStamps: CenterRanking[] = ORGANIZATIONS
    .map(o => ({ centerId: o.id, name: o.name, count: stampsByCenter.get(o.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  const byRating: CenterRatingRanking[] = ORGANIZATIONS
    .map(o => {
      const arr = ratingsByCenter.get(o.id) ?? []
      const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      return {
        centerId: o.id,
        name: o.name,
        avg: Math.round(avg * 10) / 10,
        count: arr.length,
      }
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.avg - a.avg)

  const centerSummary = ORGANIZATIONS.map(o => {
    const arr = ratingsByCenter.get(o.id) ?? []
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    return {
      centerId: o.id,
      name: o.name,
      programs: programsByCenter.get(o.id) ?? 0,
      approved: approvedByCenter.get(o.id) ?? 0,
      stamps: stampsByCenter.get(o.id) ?? 0,
      avgRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    }
  })

  const ageGroups = countAgeGroups(profiles.map(p => p.birthdate))

  // 전체 항목별 만족도 평균
  const overallAvgOf = (key: string): number | null => {
    const nums = reviews.map(r => r[key]).filter((n: any) => typeof n === 'number')
    if (nums.length === 0) return null
    return Math.round((nums.reduce((a: number, b: number) => a + b, 0) / nums.length) * 10) / 10
  }
  const satisfaction = {
    programAvg: overallAvgOf('program_rating'),
    leaderAvg: overallAvgOf('leader_rating'),
    facilityAvg: overallAvgOf('facility_rating'),
    count: reviews.length,
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    participation: { rate: Math.round(rate * 10) / 10 },
    satisfaction,
    centerRankings: { byStamps, byRating },
    centerSummary,
    ageGroups,
    latestGlobalPlan: gp
      ? {
          id: gp.id,
          title: gp.title,
          pdfUrl: gp.pdf_url,
          uploadedBy: gp.uploaded_by,
          createdAt: gp.created_at,
        }
      : null,
  }
}
