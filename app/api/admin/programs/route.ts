/**
 * 프로그램 생성/수정 — 관리자 전용.
 *
 * 예전에는 브라우저에서 programs 를 직접 insert/update 했고, 정책이
 * using(true) 라서 anon key 를 가진 누구나 17개 기관의 프로그램을 임의로
 * 만들거나 고칠 수 있었다. "본인 기관만" 검사도 브라우저 코드에만 있었다.
 *
 * 읽기는 계속 공개다 (/programs 페이지가 비로그인 방문자에게 목록을 보여준다).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'
import { ORGANIZATIONS } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[admin/programs] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

interface Fields {
  title: string
  description: string
  date: string
  time: string
  capacity: number
  target: string
  image_url: string | null
  application_url: string | null
}

/** 공통 필드 검증. 실패 시 문자열(에러 메시지) 반환. */
function parseFields(body: Record<string, unknown>): Fields | string {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return '프로그램 제목을 입력해주세요.'

  const capacity = Number(body.capacity)
  if (!Number.isFinite(capacity) || capacity < 0) return '정원은 0 이상의 숫자여야 합니다.'

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const nullable = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s || null
  }

  return {
    title,
    description: str(body.description),
    date: str(body.date),
    time: str(body.time),
    capacity,
    target: str(body.target),
    image_url: nullable(body.image_url),
    application_url: nullable(body.application_url),
  }
}

/** POST /api/admin/programs — 생성 */
export async function POST(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const orgId = Number(body.organization_id)
  const org = ORGANIZATIONS.find(o => o.id === orgId)
  if (!org) return NextResponse.json({ error: '기관을 선택해주세요.' }, { status: 400 })
  if (!canAccessCenter(session, orgId)) {
    return NextResponse.json({ error: '본인 기관의 프로그램만 만들 수 있습니다.' }, { status: 403 })
  }

  const fields = parseFields(body)
  if (typeof fields === 'string') return NextResponse.json({ error: fields }, { status: 400 })

  // id 는 클라이언트가 제안할 수 있지만 형식을 제한한다 (경로/키 주입 방지).
  const proposed = typeof body.id === 'string' ? body.id.trim() : ''
  const id = /^[A-Za-z0-9_-]{1,64}$/.test(proposed) ? proposed : `prog-${orgId}-${Date.now()}`

  // location 은 클라이언트 값을 믿지 않고 서버의 기관 데이터에서 채운다.
  const row = {
    id,
    organization_id: orgId,
    ...fields,
    location: org.name,
    updated_at: new Date().toISOString(),
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase.from('programs').insert(row).select().single()

  if (error) {
    console.error('[admin/programs] 생성 실패:', error.message)
    return NextResponse.json({ error: `생성에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ program: data })
}

/** PUT /api/admin/programs — 수정 (body.id 로 대상 지정) */
export async function PUT(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const programId = typeof body.id === 'string' ? body.id : ''
  if (!programId) return NextResponse.json({ error: '프로그램 id가 필요합니다.' }, { status: 400 })

  const fields = parseFields(body)
  if (typeof fields === 'string') return NextResponse.json({ error: fields }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  // 소유 기관은 DB 에서 읽어 확인한다 (클라이언트가 보낸 소유자 값을 믿지 않는다).
  const { data: existing, error: fetchErr } = await supabase
    .from('programs')
    .select('organization_id')
    .eq('id', programId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[admin/programs] 조회 실패:', fetchErr.message)
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: '프로그램을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!canAccessCenter(session, existing.organization_id as number)) {
    return NextResponse.json(
      { error: '본인 기관의 프로그램만 수정할 수 있습니다.' },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from('programs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', programId)

  if (error) {
    console.error('[admin/programs] 수정 실패:', error.message)
    return NextResponse.json({ error: `수정에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
