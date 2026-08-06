/**
 * 저장된 보고서 (reports) — 목록/본문 조회, 저장, 삭제.
 *
 * 권한 필터를 서버에서 강제한다. 예전에는 센터관리자용 쿼리 필터가 브라우저에
 * 있었으므로 anon key 로 다른 기관 보고서를 그대로 읽을 수 있었다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readAdminSession, type AdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIST_COLUMNS = 'id, scope, center_id, title, created_by, created_at'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[admin/reports] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/** 기존 ReportTab.canAccessReport 와 동일한 규칙 — 서버에서 강제한다. */
function canAccessReport(
  session: AdminSession,
  row: { scope: string | null; center_id: number | null },
): boolean {
  if (session.role === 'super') return true
  if (!session.center_id) return false
  return row.scope === 'center' && row.center_id === session.center_id
}

/**
 * GET /api/admin/reports        → 접근 가능한 보고서 목록
 * GET /api/admin/reports?id=... → 해당 보고서 본문(content_md)
 */
export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const { data, error } = await supabase
      .from('reports')
      .select('id, scope, center_id, content_md')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/reports] 본문 조회 실패:', error.message)
      return NextResponse.json({ error: '보고서를 불러오지 못했습니다.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
    if (!canAccessReport(session, data)) {
      return NextResponse.json(
        { error: '본인 기관 보고서만 불러올 수 있습니다.' },
        { status: 403 },
      )
    }
    return NextResponse.json({ content_md: data.content_md ?? '' })
  }

  let query = supabase.from('reports').select(LIST_COLUMNS).order('created_at', { ascending: false })
  if (session.role === 'center') {
    if (!session.center_id) return NextResponse.json({ reports: [] })
    query = query.eq('scope', 'center').eq('center_id', session.center_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/reports] 목록 조회 실패:', error.message)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ reports: (data ?? []).filter(r => canAccessReport(session, r)) })
}

/** POST /api/admin/reports — 보고서 저장 */
export async function POST(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const scope = body.scope === 'global' ? 'global' : 'center'
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const contentMd = typeof body.content_md === 'string' ? body.content_md : ''
  const createdBy = typeof body.created_by === 'string' ? body.created_by.trim() : ''

  if (!title || !contentMd) {
    return NextResponse.json({ error: '제목과 본문이 필요합니다.' }, { status: 400 })
  }

  // scope='center' 는 center_id 필수 (DB 체크 제약과 동일)
  let centerId: number | null = null
  if (scope === 'center') {
    centerId = Number(body.center_id)
    if (!Number.isInteger(centerId)) {
      return NextResponse.json({ error: '기관 보고서는 center_id 가 필요합니다.' }, { status: 400 })
    }
    // 센터관리자는 본인 기관 보고서만 저장 가능
    if (session.role === 'center' && session.center_id !== centerId) {
      return NextResponse.json({ error: '본인 기관 보고서만 저장할 수 있습니다.' }, { status: 403 })
    }
  } else if (session.role !== 'super') {
    return NextResponse.json(
      { error: '통합 보고서는 슈퍼관리자만 저장할 수 있습니다.' },
      { status: 403 },
    )
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase.from('reports').insert({
    scope,
    center_id: centerId,
    title,
    content_md: contentMd,
    created_by: createdBy,
  })

  if (error) {
    console.error('[admin/reports] 저장 실패:', error.message)
    return NextResponse.json({ error: `저장에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/admin/reports?id=... */
export async function DELETE(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: '삭제할 보고서 id가 필요합니다.' }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data: target, error: chkErr } = await supabase
    .from('reports')
    .select('scope, center_id')
    .eq('id', id)
    .maybeSingle()

  if (chkErr) {
    console.error('[admin/reports] 확인 실패:', chkErr.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
  if (!target) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
  if (!canAccessReport(session, target)) {
    return NextResponse.json({ error: '본인 기관 보고서만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { error } = await supabase.from('reports').delete().eq('id', id)

  if (error) {
    console.error('[admin/reports] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
