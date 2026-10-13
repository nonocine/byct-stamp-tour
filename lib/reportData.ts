import type { SupabaseClient } from '@supabase/supabase-js'
import { ORGANIZATIONS } from './data'

// 집계 함수는 Supabase 클라이언트를 인자로 받는다.
// reviews / center_reports / global_plans 가 RLS로 잠겨 있어서 브라우저의 anon
// 클라이언트로는 집계가 불가능하다. 호출은 /api/admin/report-data 라우트가
// service_role 클라이언트로 수행한다.

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
  // 기관별 종합 통계 — 프로그램 단위 행, 계획 일자(programs.date) 오름차순
  programSummary: {
    dates: string[] // 회차 계획 날짜 (오름차순)
    centerId: number
    centerName: string
    programTitle: string
    stamps: number
    avgRating: number | null
  }[]
  // 기관별 종합 통계 표 아래 합계 요약
  programSummaryTotals: {
    stamps: number // 표의 모든 행 스탬프 합계
    programs: number // 프로그램 행 개수 (미운영 기관·미기재 행 제외)
    centers: number // 스탬프가 1건 이상인 기관 수
    avgRating: number | null // 기관별 별점의 단순 평균 (별점 없는 기관 제외)
  }
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

export async function collectCenterReportData(
  centerId: number,
  client: SupabaseClient,
): Promise<CenterReportData> {
  const org = ORGANIZATIONS.find(o => o.id === centerId)
  if (!org) throw new Error(`기관을 찾을 수 없습니다 (centerId=${centerId})`)

  const [progRes, appRes, stampRes, reviewRes] = await Promise.all([
    client
      .from('programs')
      .select('id, title, date, time, capacity, target, plan_pdf_url')
      .eq('organization_id', centerId)
      .order('date', { ascending: true }),
    client
      .from('applications')
      .select('id, status, applied_at')
      .eq('center_id', centerId),
    client
      .from('stamp_records')
      .select('id, stamped_at, participant_id')
      .eq('center_id', centerId),
    client
      .from('reviews')
      .select('rating, comment, participant_name, program_rating, leader_rating, facility_rating, wish_program, created_at')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false }),
  ])

  // 담당지도자 종합의견 (테이블 미생성 등으로 실패해도 보고서 생성은 계속)
  let leaderOpinion: string | null = null
  try {
    const { data: opinionRow } = await client
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

  // 실제 스탬프를 받은 참가자 ID (중복 제거) — 참여 통계·연령 분포의 공통 기준
  const stampParticipantIds = Array.from(
    new Set(stamps.map(s => s.participant_id).filter(Boolean)),
  ) as string[]
  const uniqueParticipants = stampParticipantIds.length

  const rate = applications.approved > 0
    ? (stamps.length / applications.approved) * 100
    : 0

  // 연령대 — 실제 스탬프를 받은 참가자만 대상으로 birthdate 조회
  let profiles: any[] = []
  if (stampParticipantIds.length > 0) {
    const { data } = await client
      .from('profiles')
      .select('id, birthdate')
      .in('id', stampParticipantIds)
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

// "_오전", "_오후", "(1회)", "(오전)" 같은 회차·시간대 접미사를 제거해 같은 프로그램으로 묶기 위한 키
function normalizeProgramTitle(title: string): string {
  let t = title.trim()
  const suffix = /\s*(?:[_\-]\s*(?:오전|오후)|\(\s*(?:\d+\s*회|오전|오후)\s*\))$/
  while (suffix.test(t)) t = t.replace(suffix, '').trim()
  return t.replace(/\s+/g, ' ')
}

export async function collectGlobalReportData(
  client: SupabaseClient,
): Promise<GlobalReportData> {
  const [progRes, appRes, stampRes, reviewRes, profRes, gpRes] = await Promise.all([
    client.from('programs').select('id, organization_id, title, date'),
    client.from('applications').select('id, status, center_id'),
    client.from('stamp_records').select('id, center_id, participant_id, program_title, program_id'),
    client.from('reviews').select('center_id, rating, program_rating, leader_rating, facility_rating'),
    client.from('profiles').select('id, birthdate'),
    client
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

  // 실제 스탬프를 받은 참가자 ID (중복 제거) — 참여 통계·연령 분포의 공통 기준
  const stampParticipantIds = new Set(
    stamps.map(s => s.participant_id).filter(Boolean) as string[],
  )

  const totals = {
    organizations: ORGANIZATIONS.length,
    programs: programs.length,
    applications: apps.length,
    pending: apps.filter(a => a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    waiting: apps.filter(a => a.status === 'waiting').length,
    stamps: stamps.length,
    uniqueParticipants: stampParticipantIds.size,
  }

  const rate = totals.approved > 0 ? (totals.stamps / totals.approved) * 100 : 0

  const stampsByCenter = new Map<number, number>()
  for (const s of stamps) {
    if (typeof s.center_id !== 'number') continue
    stampsByCenter.set(s.center_id, (stampsByCenter.get(s.center_id) ?? 0) + 1)
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

  // 프로그램 단위 통계 — 일자는 계획 날짜(programs.date) 기준 (stamped_at 은 몰아 찍는 경우가 있어 사용하지 않음)
  // 스탬프 매칭 우선순위: ① stamp_records.program_id = programs.id (회차별 행 분리)
  //                      ② 정규화된 이름 (회차·오전/오후 접미사 제거) — 이 경우 같은 이름의 회차는 한 행으로 병합
  type SummaryRow = GlobalReportData['programSummary'][number]
  const datedRows: { firstDate: string; row: SummaryRow }[] = []
  const unscheduledRows: SummaryRow[] = []
  const inactiveRows: SummaryRow[] = []
  ORGANIZATIONS.forEach(o => {
    const arr = ratingsByCenter.get(o.id) ?? []
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    const avgRating = avg !== null ? Math.round(avg * 10) / 10 : null

    const orgPrograms = programs.filter(p => p.organization_id === o.id)
    const orgStamps = stamps.filter(s => s.center_id === o.id)

    if (orgPrograms.length === 0) {
      inactiveRows.push({ dates: [], centerId: o.id, centerName: o.name, programTitle: '-', stamps: orgStamps.length, avgRating })
      return
    }

    // program_id 로 직접 매칭되는 프로그램은 회차별로 독립된 행
    const orgProgramIds = new Set(orgPrograms.map(p => p.id as string))
    const idMatched = new Set(
      orgStamps.map(s => s.program_id).filter((id: any) => typeof id === 'string' && orgProgramIds.has(id)),
    )

    type Group = { title: string; nameKey: string; dates: Set<string>; stamps: number }
    const groups = new Map<string, Group>() // key: "id:<programs.id>" | "name:<정규화된 이름>"
    for (const p of orgPrograms) {
      const nameKey = normalizeProgramTitle(p.title ?? '')
      const key = idMatched.has(p.id) ? `id:${p.id}` : `name:${nameKey}`
      const g = groups.get(key) ?? {
        title: (idMatched.has(p.id) ? (p.title ?? '').trim() : nameKey) || '-',
        nameKey,
        dates: new Set<string>(),
        stamps: 0,
      }
      if (p.date) g.dates.add(p.date)
      groups.set(key, g)
    }

    const extra = new Map<string, number>() // 등록 프로그램과 매칭되지 않는 program_title
    let untitled = 0
    for (const s of orgStamps) {
      if (typeof s.program_id === 'string' && idMatched.has(s.program_id)) {
        groups.get(`id:${s.program_id}`)!.stamps++
        continue
      }
      const key = typeof s.program_title === 'string' ? normalizeProgramTitle(s.program_title) : ''
      if (!key) {
        if (groups.size === 1) groups.values().next().value!.stamps++
        else untitled++
        continue
      }
      const g = groups.get(`name:${key}`)
        // 이름이 회차별로 분리된 프로그램과만 일치하면, 그런 회차가 하나일 때만 귀속
        ?? (() => {
          const split = Array.from(groups.entries()).filter(([k, v]) => k.startsWith('id:') && v.nameKey === key)
          return split.length === 1 ? split[0][1] : undefined
        })()
      if (g) g.stamps++
      else extra.set(key, (extra.get(key) ?? 0) + 1)
    }

    groups.forEach(g => {
      const dates = Array.from(g.dates).sort()
      const row = { dates, centerId: o.id, centerName: o.name, programTitle: g.title, stamps: g.stamps, avgRating }
      if (dates.length > 0) datedRows.push({ firstDate: dates[0], row })
      else unscheduledRows.push(row)
    })
    extra.forEach((count, title) => {
      unscheduledRows.push({ dates: [], centerId: o.id, centerName: o.name, programTitle: title, stamps: count, avgRating })
    })
    if (untitled > 0) {
      unscheduledRows.push({ dates: [], centerId: o.id, centerName: o.name, programTitle: '미기재', stamps: untitled, avgRating })
    }
  })
  // 첫 날짜 오름차순 (같은 날짜는 기관 순서 유지), 날짜 없는 행 → 미운영 기관 순으로 맨 아래
  datedRows.sort((a, b) => a.firstDate.localeCompare(b.firstDate))
  const programSummary: SummaryRow[] = [...datedRows.map(d => d.row), ...unscheduledRows, ...inactiveRows]
  // 스탬프 0건 행은 기관 평균 별점을 표시하지 않음
  for (const r of programSummary) {
    if (r.stamps === 0) r.avgRating = null
  }

  const stampsByCenterInTable = new Map<number, number>()
  const ratingByCenterInTable = new Map<number, number>()
  for (const r of programSummary) {
    stampsByCenterInTable.set(r.centerId, (stampsByCenterInTable.get(r.centerId) ?? 0) + r.stamps)
    if (r.avgRating !== null) ratingByCenterInTable.set(r.centerId, r.avgRating)
  }
  const centerRatings = Array.from(ratingByCenterInTable.values())
  const programSummaryTotals = {
    stamps: programSummary.reduce((sum, r) => sum + r.stamps, 0),
    programs: programSummary.length - inactiveRows.length - programSummary.filter(r => r.programTitle === '미기재').length,
    centers: Array.from(stampsByCenterInTable.values()).filter(n => n > 0).length,
    avgRating: centerRatings.length > 0
      ? Math.round((centerRatings.reduce((a, b) => a + b, 0) / centerRatings.length) * 10) / 10
      : null,
  }

  // 연령대 — 실제 스탬프를 받은 참가자의 프로필만 집계
  const ageGroups = countAgeGroups(
    profiles.filter(p => stampParticipantIds.has(p.id)).map(p => p.birthdate),
  )

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
    programSummary,
    programSummaryTotals,
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
