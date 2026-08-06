/**
 * 참가자 로그인 — 전화번호 + 생년월일 검증을 서버에서 수행하고 세션 쿠키를 심는다.
 *
 * profiles 테이블 자체는 이번 단계에서 아직 잠기지 않았지만(관리자 화면 다수가
 * 여전히 브라우저에서 읽는다), 세션 쿠키는 지금 필요하다 —
 * reviews / push_subscriptions 라우트가 "본인 확인"을 할 근거가 이것뿐이다.
 */
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

  const phone = digits(body.phone)
  const birthdate = digits(body.birthdate)

  if (!phone || !birthdate) {
    return NextResponse.json({ error: '전화번호와 생년월일을 입력해주세요' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[participant/login] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, birthdate, created_at')
    .eq('phone', phone)
    .eq('birthdate', birthdate)
    .maybeSingle()

  if (error) {
    console.error('[participant/login] 조회 실패:', error.message)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: '전화번호 또는 생년월일이 일치하지 않습니다' },
      { status: 401 },
    )
  }

  let token: string
  try {
    token = signParticipantSession(data.id as string)
  } catch (e: any) {
    console.error('[participant/login] 세션 서명 실패:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다. 운영자에게 문의해주세요.' }, { status: 500 })
  }

  const res = NextResponse.json({ profile: data })
  res.cookies.set(PARTICIPANT_COOKIE, token, {
    ...participantCookieOptions,
    maxAge: PARTICIPANT_SESSION_MAX_AGE,
  })
  return res
}
