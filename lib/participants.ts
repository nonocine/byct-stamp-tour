import { supabase } from './supabase'

// profiles 와 participant_id 로 연결된 자식 테이블들.
// 스키마에 ON DELETE CASCADE 가 걸려 있는지 확신할 수 없으므로
// 자식 → 부모 순서로 직접 삭제한다. (CASCADE 가 있어도 이미 비어있는 테이블 삭제는 무해)
const CHILD_TABLES = ['stamp_records', 'reviews', 'applications', 'push_subscriptions'] as const

// .in() 필터의 URL 길이 한계를 피하기 위한 청크 크기.
const CHUNK_SIZE = 100

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 참가자(profiles)와 그 연관 데이터(stamp_records / reviews / applications /
 * push_subscriptions)를 모두 삭제한다. admins 테이블은 건드리지 않는다.
 */
export async function deleteParticipantsCascade(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const batches = chunk(ids, CHUNK_SIZE)

  for (const table of CHILD_TABLES) {
    for (const batch of batches) {
      const { error } = await supabase.from(table).delete().in('participant_id', batch)
      if (error) throw new Error(`${table} 삭제 실패: ${error.message}`)
    }
  }

  for (const batch of batches) {
    const { error } = await supabase.from('profiles').delete().in('id', batch)
    if (error) throw new Error(`profiles 삭제 실패: ${error.message}`)
  }
}

/** profiles 테이블의 모든 참가자 id 목록 (전체 삭제용). */
export async function fetchAllParticipantIds(): Promise<string[]> {
  const { data, error } = await supabase.from('profiles').select('id')
  if (error) throw new Error(`참가자 목록 조회 실패: ${error.message}`)
  return (data ?? []).map((r: { id: string }) => r.id)
}
