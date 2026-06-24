// 관리자 페이지 탭 공통 타입/유틸/상수

export const PAGE_SIZE = 20
export const PARTICIPANTS_PAGE_SIZE = 10

// 페이지 번호 리스트 — 7개 이하면 전체, 그 이상이면 ellipsis 로 압축
export function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i)
  }
  if (current <= 3) {
    return [0, 1, 2, 3, 4, 'ellipsis', total - 1]
  }
  if (current >= total - 4) {
    return [0, 'ellipsis', total - 5, total - 4, total - 3, total - 2, total - 1]
  }
  return [0, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total - 1]
}

export function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

export function formatBirthdate(bd: string) {
  const d = (bd ?? '').replace(/\D/g, '')
  if (d.length !== 8) return bd ?? ''
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 공유 타입 ────────────────────────────────────────────────────────────────

export interface StatsData {
  totalProfiles: number
  totalStamps: number
  completions: number
  centerBreakdown: { center_id: number; center_name: string; count: number }[]
}

export interface DashboardProfileRow {
  id: string
  name: string
  phone: string
  created_at: string
  stampCount: number
}

export interface ProfileResult {
  id: string
  name: string
  phone: string
  birthdate: string
}

export interface ParticipantRow {
  id: string
  name: string
  phone: string
  birthdate: string
  created_at: string
  stampCount: number
}

export interface StampRecordRow {
  id: string
  center_id: number
  center_name: string
  approved_by: string
  stamped_at: string
}

export interface AdminRow {
  id: string
  name: string
  phone: string
  role: 'super' | 'center'
  center_id: number | null
  center_name: string | null
}

export interface ReviewRow {
  id: string
  participant_id: string
  participant_name: string
  center_id: number
  center_name: string
  rating: number
  comment: string | null
  created_at: string
}

export interface ReviewSummary {
  center_id: number
  center_name: string
  count: number
  avg: number
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'waiting'
export type AppStatusFilter = 'all' | ApplicationStatus

export interface ApplicationRow {
  id: string
  participant_id: string
  participant_name: string
  participant_phone: string
  center_id: number
  center_name: string
  status: ApplicationStatus
  applied_at: string
  program_id?: string | null
  program_title?: string | null
}
