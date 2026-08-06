import { NextResponse, type NextRequest } from 'next/server'
import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readAdminSession } from '@/lib/adminSession'

export const runtime = 'nodejs'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  participantId: string
  title: string
  body: string
  tag?: string
  url?: string
}

export async function POST(req: NextRequest) {
  // 이 엔드포인트는 관리자 화면(승인/거절/스탬프 발급·취소)에서만 호출된다.
  // 예전에는 인증이 없어 누구나 임의의 참가자에게 알림을 보낼 수 있었다.
  if (!readAdminSession(req)) {
    return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
  }

  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    return NextResponse.json(
      { error: 'VAPID 키가 서버에 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[send-push] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let payload: PushPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const { participantId, title, body, tag, url } = payload
  if (!participantId || !title || !body) {
    return NextResponse.json(
      { error: 'participantId, title, body 가 필요합니다.' },
      { status: 400 },
    )
  }

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('participant_id', participantId)

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, total: 0, removed: 0, message: '구독 없음' })
  }

  const message = JSON.stringify({ title, body, tag, url })
  let sent = 0
  const staleEndpoints: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        )
        sent += 1
      } catch (err: any) {
        const code = err?.statusCode
        if (code === 404 || code === 410) {
          staleEndpoints.push(sub.endpoint)
        } else {
          console.error(
            '[send-push] 발송 실패:',
            sub.endpoint.slice(-12),
            code,
            err?.message ?? err,
          )
        }
      }
    }),
  )

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return NextResponse.json({
    sent,
    total: subs.length,
    removed: staleEndpoints.length,
  })
}
