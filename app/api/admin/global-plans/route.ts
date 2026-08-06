/**
 * 전체 사업계획서 (global_plans) — 슈퍼관리자 전용.
 *
 * PDF 파일 자체는 아직 브라우저에서 Storage 로 올린다(program-plans 버킷).
 * 이 라우트는 업로드된 URL 을 DB에 기록하는 부분만 담당한다.
 * Storage 정책 조이기는 다음 단계 과제다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function forbidden() {
  return NextResponse.json(
    { error: '슈퍼관리자 권한이 필요합니다. 다시 로그인해주세요.' },
    { status: 401 },
  )
}

function serverConfigError(e: any) {
  console.error('[admin/global-plans] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/** GET /api/admin/global-plans — 목록 */
export async function GET(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase
    .from('global_plans')
    .select('id, title, pdf_url, uploaded_by, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/global-plans] 조회 실패:', error.message)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ plans: data ?? [] })
}

/** POST /api/admin/global-plans — 업로드된 PDF URL 기록 */
export async function POST(req: NextRequest) {
  const session = readSuperAdminSession(req)
  if (!session) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const pdfUrl = typeof body.pdf_url === 'string' ? body.pdf_url.trim() : ''
  const uploadedBy = typeof body.uploaded_by === 'string' ? body.uploaded_by.trim() : ''

  if (!title || !pdfUrl) {
    return NextResponse.json({ error: '제목과 PDF URL 이 필요합니다.' }, { status: 400 })
  }
  if (!/^https:\/\//.test(pdfUrl)) {
    return NextResponse.json({ error: 'PDF URL 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase
    .from('global_plans')
    .insert({ title, pdf_url: pdfUrl, uploaded_by: uploadedBy })

  if (error) {
    console.error('[admin/global-plans] 저장 실패:', error.message)
    return NextResponse.json({ error: `저장에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/admin/global-plans?id=... */
export async function DELETE(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: '삭제할 계획서 id가 필요합니다.' }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase.from('global_plans').delete().eq('id', id)

  if (error) {
    console.error('[admin/global-plans] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
