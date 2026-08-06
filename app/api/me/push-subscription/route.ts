/**
 * 참가자 웹푸시 구독 등록.
 *
 * participant_id 는 세션 쿠키에서만 가져온다. 예전에는 브라우저가 임의의
 * participant_id 로 push_subscriptions 에 직접 upsert 할 수 있었고,
 * 그 구독 정보(endpoint/p256dh/auth)는 푸시 발송 자격 그 자체다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readParticipantSession } from '@/lib/participantSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.p256dh === 'string' ? body.p256dh : ''
  const auth = typeof body.auth === 'string' ? body.auth : ''

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: '구독 정보가 불완전합니다.' }, { status: 400 })
  }
  if (!/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: 'endpoint 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[me/push-subscription] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { participant_id: session.participantId, endpoint, p256dh, auth },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('[me/push-subscription] 등록 실패:', error.message)
    return NextResponse.json({ error: '알림 구독 등록에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
