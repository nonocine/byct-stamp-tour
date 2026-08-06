/**
 * 관리자 세션 — HMAC 서명된 HttpOnly 쿠키.
 *
 * 왜 필요한가:
 *   admins 테이블을 RLS로 잠그면 인가 판단을 서버가 해야 한다. 그런데 이 앱은
 *   Supabase Auth 를 쓰지 않고 localStorage 에만 로그인 상태를 둔다.
 *   localStorage 값은 브라우저에서 자유롭게 위조할 수 있으므로 API 라우트가
 *   그것을 신뢰할 수 없다. 그래서 로그인 성공 시 서버가 서명한 쿠키를 심고,
 *   관리자 전용 라우트는 그 쿠키만 신뢰한다.
 *
 * localStorage 의 byct_admin 은 계속 남지만 UI 표시 용도로만 쓰인다.
 * 권한의 단일 진실 소스는 이 쿠키다.
 *
 * ⚠️ 서버 전용 모듈. 클라이언트 컴포넌트에서 import 금지.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const ADMIN_COOKIE = 'byct_admin_session'

/** 세션 유효기간 12시간. 기관 담당자가 하루 업무 중 재로그인하지 않을 정도. */
export const SESSION_MAX_AGE = 60 * 60 * 12

export interface AdminSession {
  id: string
  role: 'super' | 'center'
  center_id: number | null
  exp: number
}

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

/** 쿠키에 담을 서명 토큰을 만든다. */
export function signSession(payload: Omit<AdminSession, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  return `${body}.${mac(body)}`
}

/** 서명과 만료를 검증한다. 실패 시 null. */
export function verifySession(token: string | undefined | null): AdminSession | null {
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
    if (typeof parsed?.id !== 'string') return null
    if (parsed.role !== 'super' && parsed.role !== 'center') return null
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now() / 1000) return null
    return parsed as AdminSession
  } catch {
    return null
  }
}

/** 요청의 쿠키에서 관리자 세션을 읽는다. */
export function readAdminSession(req: NextRequest): AdminSession | null {
  return verifySession(req.cookies.get(ADMIN_COOKIE)?.value)
}

/** 슈퍼관리자 세션만 통과. 아니면 null. */
export function readSuperAdminSession(req: NextRequest): AdminSession | null {
  const session = readAdminSession(req)
  return session?.role === 'super' ? session : null
}
