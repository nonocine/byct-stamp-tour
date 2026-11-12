/**
 * 소감문·특별상·문자 대상 집계 — 서버 전용 (service_role).
 *
 * 스탬프 수는 stamp_records 기준, 서로 다른 기관 수로 센다(1기관 1스탬프 규칙과 같음).
 * 이름·전화번호는 profiles 를 우선하고, 없으면 stamp_records 에 적힌 값을 쓴다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SPECIAL_AWARD_MIN_STAMPS, isMobilePhone, normalizePhone, type SmsAudience } from '@/lib/smsText'

export interface StampHolder {
  participant_id: string
  name: string
  phone: string // 숫자만
  stamp_count: number
  centers: { center_id: number; center_name: string }[]
  has_essay: boolean
  essay_center_name: string | null
  is_excellent: boolean
}

const PAGE = 1000

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** 스탬프를 1개 이상 받은 참가자 전체 (스탬프 수 많은 순) */
export async function loadStampHolders(supabase: SupabaseClient): Promise<StampHolder[]> {
  type SR = { participant_id: string | null; participant_name: string | null; participant_phone: string | null; center_id: number; center_name: string; stamped_at: string | null }
  type PF = { id: string; name: string; phone: string }
  type ES = { participant_id: string; center_name: string; is_excellent: boolean }

  const stamps = await fetchAll<SR>((a, b) =>
    supabase
      .from('stamp_records')
      .select('participant_id, participant_name, participant_phone, center_id, center_name, stamped_at')
      .order('stamped_at', { ascending: true })
      .range(a, b),
  )
  const essays = await fetchAll<ES>((a, b) =>
    supabase.from('essays').select('participant_id, center_name, is_excellent').range(a, b),
  )

  const ids = [...new Set(stamps.map(s => s.participant_id).filter((v): v is string => !!v))]
  const profiles = new Map<string, PF>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('profiles').select('id, name, phone').in('id', ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const p of (data ?? []) as PF[]) profiles.set(p.id, p)
  }
  const essayBy = new Map(essays.map(e => [e.participant_id, e]))

  const byId = new Map<string, StampHolder>()
  for (const s of stamps) {
    if (!s.participant_id) continue
    let h = byId.get(s.participant_id)
    if (!h) {
      const p = profiles.get(s.participant_id)
      const e = essayBy.get(s.participant_id)
      h = {
        participant_id: s.participant_id,
        name: p?.name ?? s.participant_name ?? '',
        phone: normalizePhone(p?.phone ?? s.participant_phone ?? ''),
        stamp_count: 0,
        centers: [],
        has_essay: !!e,
        essay_center_name: e?.center_name ?? null,
        is_excellent: !!e?.is_excellent,
      }
      byId.set(s.participant_id, h)
    }
    if (!h.centers.some(c => c.center_id === s.center_id)) {
      h.centers.push({ center_id: s.center_id, center_name: s.center_name })
      h.stamp_count = h.centers.length
    }
  }

  return [...byId.values()].sort((a, b) => b.stamp_count - a.stamp_count || a.name.localeCompare(b.name, 'ko'))
}

export function filterAudience(holders: StampHolder[], audience: SmsAudience): StampHolder[] {
  switch (audience) {
    case 'stamp_all':
      return holders
    case 'essay_missing':
      return holders.filter(h => !h.has_essay)
    case 'special_award':
      return holders.filter(h => h.stamp_count >= SPECIAL_AWARD_MIN_STAMPS)
  }
}

/** 대상 → 보낼 번호 (휴대전화만, 중복 제거). 형제가 한 번호를 쓰는 경우 1건만 간다. */
export function audiencePhones(holders: StampHolder[]): { phones: string[]; people: number; invalid: number } {
  const set = new Set<string>()
  let invalid = 0
  for (const h of holders) {
    if (isMobilePhone(h.phone)) set.add(h.phone)
    else invalid += 1
  }
  return { phones: [...set], people: holders.length, invalid }
}
