/** 참가자 회원가입 — 중복 확인 후 생성하고 세션 쿠키를 심는다. */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  PARTICIPANT_COOKIE,
  PARTICIPANT_SESSION_MAX_AGE,
  participantCookieOptions,
  signParticipantSession,
} from '@/lib/participantSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function digits(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\D/g, '') : ''
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = digits(body.phone)
  const birthdate = digits(body.birthdate)

  if (!name || !phone || !birthdate) {
    return NextResponse.json({ error: '이름, 전화번호, 생년월일을 모두 입력해주세요' }, { status: 400 })
  }
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다' }, { status: 400 })
  }
  if (birthdate.length !== 8) {
    return NextResponse.json({ error: '생년월일 8자리를 입력해주세요' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[participant/signup] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: '이미 등록된 전화번호입니다. 로그인해주세요.', field: 'phone' },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({ name, phone, birthdate })
    .select('id, name, phone, birthdate, created_at')
    .single()

  if (error) {
    console.error('[participant/signup] 생성 실패:', error.message)
    return NextResponse.json({ error: '회원가입에 실패했습니다.' }, { status: 500 })
  }

  let token: string
  try {
    token = signParticipantSession(data.id as string)
  } catch (e: any) {
    console.error('[participant/signup] 세션 서명 실패:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const res = NextResponse.json({ profile: data })
  res.cookies.set(PARTICIPANT_COOKIE, token, {
    ...participantCookieOptions,
    maxAge: PARTICIPANT_SESSION_MAX_AGE,
  })
  return res
}
