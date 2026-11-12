/**
 * 문자 중계 서버(sms-relay) 클라이언트 — 서버 전용.
 * dongrae-business-trip lib/sms/relay.ts 의 sendSms·sendSmsBatch 를 그대로 옮김.
 *
 *   * 실제 업체는 알리고. 앱은 알리고를 직접 부르지 않고 중계 서버 POST /send 를 부른다.
 *   * SMS_RELAY_URL · SMS_RELAY_KEY 는 서버 환경변수로만 (NEXT_PUBLIC 금지).
 *   * SMS_SENDER(선택): 발신번호. 비우면 중계 서버의 기본 발신번호를 쓴다.
 *   ⚠️ 전화번호를 로그·콘솔·DB 어디에도 남기지 않는다.
 */
import { SMS_CHUNK_SIZE, SMS_SPLIT_THRESHOLD } from '@/lib/smsText'

const TIMEOUT_MS = 15_000

export type RelayFailure = { ok: false; status: number; error: string }

export type SendSmsResult =
  | {
      ok: true
      sent: number
      failed: number
      msg_type: string | null
      provider_msg_id: string | null
      sender: string | null
      partial?: string
    }
  | RelayFailure

function relayConfig(): { url: string; key: string } | null {
  if (typeof window !== 'undefined') throw new Error('smsRelay 는 서버에서만 사용할 수 있습니다.')
  const url = (process.env.SMS_RELAY_URL ?? '').trim().replace(/\/+$/, '')
  const key = (process.env.SMS_RELAY_KEY ?? '').trim()
  return url && key ? { url, key } : null
}

export function defaultSender(): string | undefined {
  const s = (process.env.SMS_SENDER ?? '').replace(/\D/g, '')
  return s || undefined
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const str = (v: unknown) => (typeof v === 'string' && v ? v : v != null && v !== '' ? String(v) : null)

async function sendOnce(to: string[], text: string, test: boolean, sender?: string): Promise<SendSmsResult> {
  const cfg = relayConfig()
  if (!cfg) {
    return { ok: false, status: 503, error: '문자 중계 서버 설정(SMS_RELAY_URL·SMS_RELAY_KEY)이 없습니다.' }
  }
  let res: Response
  try {
    res = await fetch(`${cfg.url}/send`, {
      method: 'POST',
      headers: { 'X-App-Key': cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text, test, ...(sender ? { sender } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    return {
      ok: false,
      status: 504,
      error: timedOut ? '문자 중계 서버가 15초 안에 답하지 않았습니다.' : '문자 중계 서버에 연결하지 못했습니다.',
    }
  }
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    // 본문이 JSON 이 아니면 비워 둔다.
  }
  if (!res.ok || data.ok === false) {
    const err = typeof data.error === 'string' && data.error ? data.error : `문자 중계 서버 오류(${res.status})`
    return { ok: false, status: res.ok ? 502 : res.status, error: err }
  }
  return {
    ok: true,
    sent: num(data.sent),
    failed: num(data.failed),
    msg_type: str(data.msg_type),
    provider_msg_id: str(data.provider_msg_id),
    sender: str(data.sender),
  }
}

/**
 * 발송 — 1,000명을 넘으면 500명씩 차례로 보내 합산한다.
 * 일부 묶음만 실패하면 ok:true + partial(실패 사유). 전부 실패하면 ok:false.
 */
export async function sendSmsBatch(input: {
  to: string[]
  text: string
  test: boolean
  sender?: string
}): Promise<SendSmsResult> {
  const chunks: string[][] = []
  if (input.to.length > SMS_SPLIT_THRESHOLD) {
    for (let i = 0; i < input.to.length; i += SMS_CHUNK_SIZE) chunks.push(input.to.slice(i, i + SMS_CHUNK_SIZE))
  } else {
    chunks.push(input.to)
  }

  let sent = 0
  let failed = 0
  const ids: string[] = []
  const errors: string[] = []
  let msgType: string | null = null
  let sender: string | null = null
  let lastFailure: RelayFailure | null = null

  for (const [i, to] of chunks.entries()) {
    const r = await sendOnce(to, input.text, input.test, input.sender)
    if (!r.ok) {
      failed += to.length
      errors.push(`${i + 1}번째 묶음(${to.length}명): ${r.error}`)
      lastFailure = r
      // 권한·설정 문제와 하루 한도는 다음 묶음도 똑같이 실패하므로 멈춘다.
      if ([400, 401, 403, 429, 503].includes(r.status)) {
        const rest = chunks.slice(i + 1).reduce((a, c) => a + c.length, 0)
        failed += rest
        if (rest > 0) errors.push(`남은 ${rest}명은 보내지 않았습니다.`)
        break
      }
      continue
    }
    sent += r.sent
    failed += r.failed
    if (r.provider_msg_id) ids.push(r.provider_msg_id)
    msgType = msgType ?? r.msg_type
    sender = sender ?? r.sender
  }

  if (ids.length === 0 && lastFailure) {
    return chunks.length === 1 ? lastFailure : { ...lastFailure, error: errors.join(' / ') }
  }
  return {
    ok: true,
    sent,
    failed,
    msg_type: msgType,
    provider_msg_id: ids.length > 0 ? ids.join(',') : null,
    sender,
    ...(errors.length > 0 ? { partial: errors.join(' / ') } : {}),
  }
}
