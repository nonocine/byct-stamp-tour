/**
 * 관리자용 평가 조회/삭제.
 *
 * 센터관리자는 본인 기관 평가만 볼 수 있다 — 예전에는 브라우저에서 필터 없이
 * reviews 전체를 읽을 수 있었으므로 클라이언트 필터는 보호 수단이 아니었다.
 * 삭제는 슈퍼관리자만 (기존 UI 규칙과 동일).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession, readSuperAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIST_COLUMNS =
  'id, participant_id, participant_name, center_id, center_name, rating, comment, created_at'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[admin/reviews] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/**
 * GET /api/admin/reviews?centerId=N            → 기관별 평가 목록
 * GET /api/admin/reviews                       → 전체 (슈퍼만)
 * GET /api/admin/reviews?participantId=&centerId= → 특정 참가자의 해당 기관 평가 여부
 */
export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  const params = req.nextUrl.searchParams
  const centerIdParam = params.get('centerId')
  const participantId = params.get('participantId')

  // 센터관리자는 항상 본인 기관으로 강제한다.
  let centerId: number | null = centerIdParam === null ? null : Number(centerIdParam)
  if (centerId !== null && !Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 올바르지 않습니다.' }, { status: 400 })
  }
  if (session.role === 'center') {
    if (!session.center_id) return forbidden()
    centerId = session.center_id
  }
  if (centerId !== null && !canAccessCenter(session, centerId)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  let query = supabase.from('reviews').select(LIST_COLUMNS).order('created_at', { ascending: false })
  if (centerId !== null) query = query.eq('center_id', centerId)
  if (participantId) query = query.eq('participant_id', participantId)

  const { data, error } = await query

  if (error) {
    console.error('[admin/reviews] 조회 실패:', error.message)
    return NextResponse.json({ error: '평가를 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ reviews: data ?? [] })
}

/** DELETE /api/admin/reviews?id=<uuid> — 슈퍼관리자만 */
export async function DELETE(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: '삭제할 평가 id가 필요합니다.' }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase.from('reviews').delete().eq('id', id)

  if (error) {
    console.error('[admin/reviews] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
