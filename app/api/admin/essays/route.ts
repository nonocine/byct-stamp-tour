/**
 * 관리자용 소감문 — 목록 / 우수작 선정·해제.
 *
 * 센터관리자: 아이가 고른 기관(center_id)이 본인 기관인 소감문만. 서버가 강제한다.
 * 슈퍼관리자: 전체 + ?centerId= 기관 필터 + ?excellent=1 우수작만.
 * 전화번호는 슈퍼관리자에게만 내려준다(선물 발송·문자용). 센터관리자 화면에는 필요 없다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_COLUMNS =
  'id, participant_id, participant_name, center_id, center_name, q_activity, q_memory, q_feeling, q_message, photo_url, is_excellent, excellent_by, excellent_at, created_at, updated_at'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverError(tag: string, e: any, msg: string) {
  console.error(`[admin/essays] ${tag}:`, e?.message)
  return NextResponse.json({ error: msg }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  const params = req.nextUrl.searchParams
  let centerId: number | null = params.get('centerId') ? Number(params.get('centerId')) : null
  if (centerId !== null && !Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 올바르지 않습니다.' }, { status: 400 })
  }
  if (session.role === 'center') {
    if (!session.center_id) return forbidden()
    centerId = session.center_id
  }

  try {
    const supabase = getSupabaseAdmin()
    const columns = session.role === 'super' ? `${BASE_COLUMNS}, participant_phone` : BASE_COLUMNS
    let q = supabase.from('essays').select(columns).order('created_at', { ascending: false })
    if (centerId !== null) q = q.eq('center_id', centerId)
    if (params.get('excellent') === '1') q = q.eq('is_excellent', true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return NextResponse.json({ essays: data ?? [] })
  } catch (e) {
    return serverError('조회 실패', e, '소감문을 불러오지 못했습니다.')
  }
}

/** PATCH /api/admin/essays  { id, excellent: boolean } */
export async function PATCH(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let body: { id?: unknown; excellent?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id || typeof body.excellent !== 'boolean') {
    return NextResponse.json({ error: 'id 와 excellent 가 필요합니다.' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: essay, error: e1 } = await supabase.from('essays').select('id, center_id').eq('id', id).maybeSingle()
    if (e1) throw new Error(e1.message)
    if (!essay) return NextResponse.json({ error: '소감문을 찾을 수 없습니다.' }, { status: 404 })
    if (!canAccessCenter(session, essay.center_id)) {
      return NextResponse.json({ error: '본인 기관으로 들어온 소감문만 선정할 수 있습니다.' }, { status: 403 })
    }

    let adminName = '관리자'
    if (body.excellent) {
      const { data: a } = await supabase.from('admins').select('name').eq('id', session.id).maybeSingle()
      if (a?.name) adminName = a.name
    }

    const patch = body.excellent
      ? { is_excellent: true, excellent_by: adminName, excellent_at: new Date().toISOString() }
      : { is_excellent: false, excellent_by: null, excellent_at: null }

    const { data, error } = await supabase
      .from('essays')
      .update(patch)
      .eq('id', id)
      .select('id, is_excellent, excellent_by, excellent_at')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, essay: data })
  } catch (e) {
    return serverError('선정 실패', e, '저장에 실패했습니다. 다시 시도해주세요.')
  }
}
