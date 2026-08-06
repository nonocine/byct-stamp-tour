/**
 * 서명 쿠키 공통 primitive — 관리자/참가자 세션이 함께 쓴다.
 *
 * 토큰 형식: base64url(JSON payload + exp) + "." + base64url(HMAC-SHA256)
 * 이 형식은 1단계에서 배포된 관리자 세션과 동일하다. 기존 세션이 무효화되지
 * 않도록 형식을 바꾸지 말 것.
 *
 * ⚠️ 서버 전용 모듈.
 */
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * 서명 키. 이름은 ADMIN_SESSION_SECRET 이지만 참가자 세션도 같은 키로 서명한다
 * (1단계에서 이미 배포·등록된 변수라 이름을 유지한다).
 * 두 세션은 쿠키 이름과 payload 필수 필드가 달라서 서로 대입할 수 없다.
 */
function getSecret(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET ?? ''
  if (secret.length < 32) {
    // fail closed — 시크릿이 없으면 세션을 발급/검증하지 않는다.
    throw new Error(
      'ADMIN_SESSION_SECRET 이 설정되지 않았거나 너무 짧습니다(32자 이상 필요). ' +
        '.env.local 과 Vercel 환경변수를 확인해주세요.',
    )
  }
  return Buffer.from(secret, 'utf8')
}

function mac(body: string): string {
  return createHmac('sha256', getSecret()).update(body).digest('base64url')
}

/** payload 에 exp 를 붙여 서명한 토큰을 만든다. */
export function signPayload(payload: Record<string, unknown>, maxAgeSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  return `${body}.${mac(body)}`
}

/**
 * 서명과 만료를 검증하고 payload 를 돌려준다. 실패 시 null.
 * 필드 검증은 호출부(각 세션 모듈)가 담당한다.
 */
export function verifyPayload(token: string | undefined | null): Record<string, any> | null {
  if (!token) return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null

  const body = token.slice(0, dot)
  const provided = Buffer.from(token.slice(dot + 1), 'utf8')

  let expected: Buffer
  try {
    expected = Buffer.from(mac(body), 'utf8')
  } catch {
    return null // 시크릿 미설정
  }

  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof parsed?.exp !== 'number' || parsed.exp < Date.now() / 1000) return null
    return parsed
  } catch {
    return null
  }
}
