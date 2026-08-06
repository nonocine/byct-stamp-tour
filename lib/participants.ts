/**
 * 참가자 삭제 헬퍼 — 실제 삭제는 /api/admin/participants 가 service_role 로 수행한다.
 *
 * 연쇄 삭제 대상에 RLS로 잠긴 테이블(reviews / push_subscriptions)이 섞여 있어
 * 브라우저에서 직접 지우면 절반만 지워진 상태가 된다. 그래서 서버로 옮겼다.
 */

async function readError(res: Response, fallback: string): Promise<string> {
  const payload = await res.json().catch(() => null)
  return payload?.error ?? fallback
}

/**
 * 참가자(profiles)와 그 연관 데이터(stamp_records / reviews / applications /
 * push_subscriptions)를 모두 삭제한다. admins 테이블은 건드리지 않는다.
 */
export async function deleteParticipantsCascade(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const res = await fetch('/api/admin/participants', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })

  if (!res.ok) throw new Error(await readError(res, '참가자 삭제에 실패했습니다.'))
}

/** profiles 테이블의 모든 참가자 id 목록 (전체 삭제용). */
export async function fetchAllParticipantIds(): Promise<string[]> {
  const res = await fetch('/api/admin/participants?idsOnly=1', { cache: 'no-store' })

  if (!res.ok) throw new Error(await readError(res, '참가자 목록 조회에 실패했습니다.'))

  const payload = await res.json()
  return (payload.ids ?? []) as string[]
}
