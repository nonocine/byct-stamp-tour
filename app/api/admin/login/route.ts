/**
 * 관리자 로그인 — 비밀번호 검증을 서버에서 수행한다.
 *
 * 이전 구조(app/admin/login/page.tsx)는 브라우저에서 admins 를 select('*') 로
 * 읽어 클라이언트에서 비밀번호를 비교했다. anon key 는 공개 값이므로 누구나
 * 관리자 전원의 평문 비밀번호를 덤프할 수 있었다.
 * 이제 비밀번호는 서버 경계를 넘지 않고, 응답에도 포함되지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { ADMIN_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/adminSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GENERIC_ERROR = '전화번호 또는 비밀번호가 올바르지 않습니다'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export async function POST(req: NextRequest) {
  let body: { phone?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const phoneInput = typeof body.phone === 'string' ? body.phone : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!phoneInput || !password) {
    return NextResponse.json(
      { error: '전화번호와 비밀번호를 입력해주세요' },
      { status: 400 },
    )
  }

  // DB에 숫자형(01012345678)과 하이픈형(010-1234-5678)이 섞여 있어 둘 다 조회한다.
  // 기존 클라이언트 로직의 동작을 그대로 보존.
  const rawPhone = phoneInput.replace(/\D/g, '')
  const formattedPhone = rawPhone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')
  const candidates = Array.from(new Set([rawPhone, formattedPhone]))

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[admin/login] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('admins')
    .select('id, name, phone, password, role, center_id, center_name')
    .in('phone', candidates)
    .limit(2)

  if (error) {
    console.error('[admin/login] 조회 실패:', error.message)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const found = (data ?? []).find(
    (row: any) => typeof row?.password === 'string' && safeEqual(row.password, password),
  )

  if (!found) {
    // 계정 존재 여부를 구분해서 알려주지 않는다 (계정 열거 방지).
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  const admin = {
    id: found.id as string,
    name: found.name as string,
    phone: found.phone as string,
    role: found.role as 'super' | 'center',
    center_id: (found.center_id ?? null) as number | null,
    center_name: (found.center_name ?? null) as string | null,
  }

  let token: string
  try {
    token = signSession({ id: admin.id, role: admin.role, center_id: admin.center_id })
  } catch (e: any) {
    console.error('[admin/login] 세션 서명 실패:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const res = NextResponse.json({ admin })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
