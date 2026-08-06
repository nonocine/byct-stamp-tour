/**
 * 관리자 계정 관리 — 슈퍼관리자 전용.
 *
 * 인가는 HMAC 서명된 HttpOnly 쿠키로만 판단한다. 클라이언트가 보내는
 * role/id 같은 값은 신뢰하지 않는다(위조 가능).
 *
 * 응답에 password 컬럼은 절대 포함하지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'
import { ORGANIZATIONS } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SAFE_COLUMNS = 'id, name, phone, role, center_id, center_name'

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[admin/admins] 서버 설정 오류:', e?.message)
  return NextResponse.json(
    { error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' },
    { status: 500 },
  )
}

/** 관리자 목록 */
export async function GET(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase.from('admins').select(SAFE_COLUMNS).order('role')

  if (error) {
    console.error('[admin/admins] 목록 조회 실패:', error.message)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ admins: data ?? [] })
}

/** 관리자 추가 */
export async function POST(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role === 'super' ? 'super' : 'center'

  if (!name || !phone || !password) {
    return NextResponse.json(
      { error: '이름, 전화번호, 비밀번호를 입력해주세요' },
      { status: 400 },
    )
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다' }, { status: 400 })
  }

  // center_name 은 클라이언트 값을 쓰지 않고 서버의 기관 데이터에서 도출한다.
  let centerId: number | null = null
  let centerName: string | null = null
  if (role === 'center') {
    const parsed = Number(body.center_id)
    const org = ORGANIZATIONS.find(o => o.id === parsed)
    if (!org) {
      return NextResponse.json({ error: '기관을 선택해주세요' }, { status: 400 })
    }
    centerId = org.id
    centerName = org.name
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  // 전화번호 중복 확인 (숫자형/하이픈형 모두)
  const formatted = phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
  const { data: existing } = await supabase
    .from('admins')
    .select('id')
    .in('phone', Array.from(new Set([phone, formatted])))
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('admins')
    .insert({
      name,
      phone,
      password,
      role,
      center_id: centerId,
      center_name: centerName,
    })
    .select(SAFE_COLUMNS)
    .single()

  if (error) {
    console.error('[admin/admins] 추가 실패:', error.message)
    return NextResponse.json({ error: '추가에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ admin: data })
}

/** 관리자 삭제 — /api/admin/admins?id=<uuid> */
export async function DELETE(req: NextRequest) {
  const session = readSuperAdminSession(req)
  if (!session) return forbidden()

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) {
    return NextResponse.json({ error: '삭제할 관리자 id가 필요합니다.' }, { status: 400 })
  }
  if (id === session.id) {
    return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { error } = await supabase.from('admins').delete().eq('id', id)

  if (error) {
    console.error('[admin/admins] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
