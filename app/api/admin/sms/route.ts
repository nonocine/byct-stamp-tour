/**
 * 문자 공지 — 슈퍼관리자 전용. 문자 중계 서버(알리고) 경유, lib/smsRelay.
 *
 *   action: 'preview' { audience }                    → 예상 인원(전화번호 중복 제거 후)
 *   action: 'test'    { text, testNumber }             → 관리자 번호 1곳에 실제 발송 + testToken
 *   action: 'send'    { audience, text, testToken }    → 대상 전체 발송
 *
 * 전체 발송은 같은 본문으로 테스트 발송이 성공했을 때만 된다. 서버가 본문 해시를 서명한
 * testToken(30분)을 확인한다 — 화면 버튼을 우회해도 막힌다.
 * 대상 번호는 화면에서 받지 않고 서버가 다시 계산한다.
 *
 * 기록: sms_send_logs, channel='byct'. sent_by 는 drivers(id) FK 라서(BYCT 관리자는 drivers 에
 * 없음) null 로 두고, 보낸 관리자 이름은 audience_desc 에 남긴다.
 * ⚠️ 받는 번호는 DB·로그·콘솔·응답 어디에도 남기지 않는다(인원 수만).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'
import { signPayload, verifyPayload } from '@/lib/sessionCrypto'
import { audiencePhones, filterAudience, loadStampHolders } from '@/lib/essayServer'
import { defaultSender, sendSmsBatch } from '@/lib/smsRelay'
import {
  LMS_MAX_BYTES,
  SMS_AUDIENCE_LABEL,
  SMS_MAX_RECIPIENTS,
  eucKrBytes,
  isMobilePhone,
  normalizePhone,
  smsMsgType,
  type SmsAudience,
} from '@/lib/smsText'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEST_TOKEN_MAX_AGE = 30 * 60

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function textHash(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

function isAudience(v: unknown): v is SmsAudience {
  return typeof v === 'string' && v in SMS_AUDIENCE_LABEL
}

async function adminName(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data } = await supabase.from('admins').select('name').eq('id', id).maybeSingle()
  return (data?.name as string | undefined) ?? '슈퍼관리자'
}

async function insertLog(supabase: ReturnType<typeof getSupabaseAdmin>, log: Record<string, unknown>) {
  const { error } = await supabase.from('sms_send_logs').insert(log)
  if (error) console.error('[admin/sms] 발송 이력 기록 실패:', error.message)
}

export async function POST(req: NextRequest) {
  const session = readSuperAdminSession(req)
  if (!session) return fail(401, '슈퍼관리자만 문자를 보낼 수 있습니다. 다시 로그인해주세요.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, '요청 형식이 올바르지 않습니다.')
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[admin/sms] 서버 설정 오류:', e?.message)
    return fail(500, '서버 설정 오류입니다.')
  }

  const action = body.action
  const text = typeof body.text === 'string' ? body.text.trim() : ''

  // ── 예상 인원 ──────────────────────────────────────────────────────────
  if (action === 'preview') {
    if (!isAudience(body.audience)) return fail(400, '대상을 선택하세요.')
    try {
      const holders = filterAudience(await loadStampHolders(supabase), body.audience)
      const { phones, people, invalid } = audiencePhones(holders)
      return NextResponse.json({ people, phones: phones.length, invalid })
    } catch (e: any) {
      console.error('[admin/sms] 대상 계산 실패:', e?.message)
      return fail(500, '대상을 불러오지 못했습니다.')
    }
  }

  if (action !== 'test' && action !== 'send') return fail(400, '알 수 없는 요청입니다.')

  if (!text) return fail(400, '문구를 입력하세요.')
  if (eucKrBytes(text) > LMS_MAX_BYTES) return fail(400, `문구가 ${LMS_MAX_BYTES.toLocaleString()}바이트를 넘습니다.`)
  const sender = defaultSender()
  const name = await adminName(supabase, session.id)

  // ── 테스트 발송 (관리자 번호 1곳, 실제 발송) ────────────────────────────
  if (action === 'test') {
    const to = normalizePhone(String(body.testNumber ?? ''))
    if (!isMobilePhone(to)) return fail(400, '테스트 받을 휴대전화 번호(010)를 확인하세요.')

    const r = await sendSmsBatch({ to: [to], text, test: false, sender })
    await insertLog(supabase, {
      sent_by: null,
      channel: 'byct',
      program: 'byct-notice',
      audience_desc: `[BYCT] 테스트 발송(관리자 번호) · 보낸 사람 ${name}`.slice(0, 500),
      recipient_count: 1,
      text_body: text,
      msg_type: r.ok ? r.msg_type ?? smsMsgType(text) : smsMsgType(text),
      sender: r.ok ? r.sender ?? sender ?? null : sender ?? null,
      is_test: true,
      ok: r.ok,
      sent_count: r.ok ? r.sent : 0,
      failed_count: r.ok ? r.failed : 1,
      provider_msg_id: r.ok ? r.provider_msg_id : null,
      error: r.ok ? r.partial ?? null : r.error,
    })
    if (!r.ok) return fail(r.status >= 400 && r.status < 600 ? r.status : 502, r.error)
    if (r.sent === 0 && r.failed > 0) return fail(502, '테스트 문자가 실패로 집계되었습니다.')

    const testToken = signPayload({ kind: 'byct-sms-test', admin: session.id, h: textHash(text) }, TEST_TOKEN_MAX_AGE)
    return NextResponse.json({ ok: true, testToken, msg_type: r.msg_type ?? smsMsgType(text) })
  }

  // ── 전체 발송 ───────────────────────────────────────────────────────────
  if (!isAudience(body.audience)) return fail(400, '대상을 선택하세요.')
  const token = verifyPayload(typeof body.testToken === 'string' ? body.testToken : null)
  if (!token || token.kind !== 'byct-sms-test' || token.admin !== session.id || token.h !== textHash(text)) {
    return fail(400, '이 문구로 테스트 발송을 먼저 성공해야 합니다. (문구를 고쳤다면 다시 테스트하세요)')
  }

  let to: string[]
  let people: number
  try {
    const holders = filterAudience(await loadStampHolders(supabase), body.audience)
    const r = audiencePhones(holders)
    to = r.phones
    people = r.people
  } catch (e: any) {
    console.error('[admin/sms] 대상 계산 실패:', e?.message)
    return fail(500, '대상을 불러오지 못했습니다.')
  }
  if (to.length === 0) return fail(400, '보낼 번호가 없습니다.')
  if (to.length > SMS_MAX_RECIPIENTS) {
    return fail(400, `한 번에 ${SMS_MAX_RECIPIENTS.toLocaleString()}명까지 보낼 수 있습니다(지금 ${to.length}명).`)
  }

  const label = SMS_AUDIENCE_LABEL[body.audience]
  const r = await sendSmsBatch({ to, text, test: false, sender })
  await insertLog(supabase, {
    sent_by: null,
    channel: 'byct',
    program: 'byct-notice',
    audience_desc: `[BYCT] ${label} ${to.length}번호(${people}명) · 보낸 사람 ${name}`.slice(0, 500),
    recipient_count: to.length,
    text_body: text,
    msg_type: r.ok ? r.msg_type ?? smsMsgType(text) : smsMsgType(text),
    sender: r.ok ? r.sender ?? sender ?? null : sender ?? null,
    is_test: false,
    ok: r.ok,
    sent_count: r.ok ? r.sent : 0,
    failed_count: r.ok ? r.failed : to.length,
    provider_msg_id: r.ok ? r.provider_msg_id : null,
    error: r.ok ? r.partial ?? null : r.error,
  })

  if (!r.ok) {
    console.error(`[admin/sms] 발송 실패(${body.audience}, ${to.length}명): ${r.error}`)
    return fail(r.status >= 400 && r.status < 600 ? r.status : 502, r.error)
  }
  return NextResponse.json({
    ok: true,
    sent: r.sent,
    failed: r.failed,
    total: to.length,
    msg_type: r.msg_type ?? smsMsgType(text),
    ...(r.partial ? { partial: r.partial } : {}),
  })
}
