/**
 * 참가자 일괄 삭제 — 슈퍼관리자 전용.
 *
 * 왜 서버로 옮겼나: 연쇄 삭제가 reviews / push_subscriptions (이번 단계에서 잠김)
 * 와 stamp_records / applications / profiles (아직 열림) 를 함께 지운다.
 * 브라우저에서는 잠긴 쪽이 실패해 절반만 지워진 상태가 되므로 전부 서버에서
 * service_role 로 처리한다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** profiles 와 participant_id 로 연결된 자식 테이블 — 자식 → 부모 순으로 지운다. */
const CHILD_TABLES = ['stamp_records', 'reviews', 'applications', 'push_subscriptions'] as const

/** .in() 필터 길이 한계를 피하기 위한 청크 크기. */
const CHUNK_SIZE = 100

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function forbidden() {
  return NextResponse.json(
    { error: '슈퍼관리자 권한이 필요합니다. 다시 로그인해주세요.' },
    { status: 401 },
  )
}

function serverConfigError(e: any) {
  console.error('[admin/participants] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/** GET /api/admin/participants?idsOnly=1 — 전체 참가자 id (전체 삭제용) */
export async function GET(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase.from('profiles').select('id')

  if (error) {
    console.error('[admin/participants] 목록 조회 실패:', error.message)
    return NextResponse.json({ error: `참가자 목록 조회 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ids: (data ?? []).map((r: { id: string }) => r.id) })
}

/** DELETE /api/admin/participants — body: { ids: string[] } */
export async function DELETE(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []

  if (ids.length === 0) {
    return NextResponse.json({ error: '삭제할 참가자 id가 필요합니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const batches = chunk(ids, CHUNK_SIZE)

  for (const table of CHILD_TABLES) {
    for (const batch of batches) {
      const { error } = await supabase.from(table).delete().in('participant_id', batch)
      if (error) {
        console.error(`[admin/participants] ${table} 삭제 실패:`, error.message)
        return NextResponse.json(
          { error: `${table} 삭제 실패: ${error.message}` },
          { status: 500 },
        )
      }
    }
  }

  for (const batch of batches) {
    const { error } = await supabase.from('profiles').delete().in('id', batch)
    if (error) {
      console.error('[admin/participants] profiles 삭제 실패:', error.message)
      return NextResponse.json({ error: `profiles 삭제 실패: ${error.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, deleted: ids.length })
}
