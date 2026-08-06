/**
 * 기관 담당지도자 종합의견 + 현장 사진 URL (center_reports).
 *
 * 읽기: 해당 기관 접근 권한이 있는 관리자 (센터=본인 기관, 슈퍼=전체)
 * 쓰기: 본인 기관 센터관리자만 — 슈퍼관리자는 읽기 전용 (기존 UI 규칙과 동일)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[admin/center-report] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/** GET /api/admin/center-report?centerId=N */
export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  const centerId = Number(req.nextUrl.searchParams.get('centerId'))
  if (!Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 필요합니다.' }, { status: 400 })
  }
  if (!canAccessCenter(session, centerId)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase
    .from('center_reports')
    .select('opinion, photo_urls')
    .eq('center_id', centerId)
    .maybeSingle()

  if (error) {
    console.error('[admin/center-report] 조회 실패:', error.message)
    return NextResponse.json({ error: '종합의견을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    opinion: data?.opinion ?? '',
    photo_urls: (data?.photo_urls as string[] | null) ?? [],
  })
}

/**
 * PUT /api/admin/center-report
 * body: { centerId, opinion? , photo_urls? }
 * opinion 과 photo_urls 는 각각 독립적으로 갱신된다 (한쪽만 보내면 다른 쪽은 유지).
 */
export async function PUT(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const centerId = Number(body.centerId)
  if (!Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 필요합니다.' }, { status: 400 })
  }

  // 쓰기는 본인 기관 센터관리자만 (슈퍼는 읽기 전용)
  if (session.role !== 'center' || session.center_id !== centerId) {
    return NextResponse.json(
      { error: '본인 기관의 담당지도자만 저장할 수 있습니다.' },
      { status: 403 },
    )
  }

  const patch: Record<string, unknown> = {
    center_id: centerId,
    updated_at: new Date().toISOString(),
  }

  if ('opinion' in body) {
    const opinion = typeof body.opinion === 'string' ? body.opinion.trim() : ''
    patch.opinion = opinion || null
  }
  if ('photo_urls' in body) {
    if (!Array.isArray(body.photo_urls)) {
      return NextResponse.json({ error: 'photo_urls 는 배열이어야 합니다.' }, { status: 400 })
    }
    const urls = body.photo_urls.filter((u): u is string => typeof u === 'string').slice(0, 5)
    patch.photo_urls = urls
  }

  if (!('opinion' in patch) && !('photo_urls' in patch)) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase
    .from('center_reports')
    .upsert(patch, { onConflict: 'center_id' })

  if (error) {
    console.error('[admin/center-report] 저장 실패:', error.message)
    return NextResponse.json({ error: `저장에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
