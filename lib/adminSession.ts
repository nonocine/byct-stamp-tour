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
 * 서명 primitive 는 lib/sessionCrypto.ts 와 공유한다 (토큰 형식 동일 —
 * 형식을 바꾸면 사용 중인 관리자 세션이 전부 무효화된다).
 *
 * ⚠️ 서버 전용 모듈. 클라이언트 컴포넌트에서 import 금지.
 */
import type { NextRequest } from 'next/server'
import { signPayload, verifyPayload } from '@/lib/sessionCrypto'

export const ADMIN_COOKIE = 'byct_admin_session'

/** 세션 유효기간 12시간. 기관 담당자가 하루 업무 중 재로그인하지 않을 정도. */
export const SESSION_MAX_AGE = 60 * 60 * 12

export interface AdminSession {
  id: string
  role: 'super' | 'center'
  center_id: number | null
  exp: number
}

/** 쿠키에 담을 서명 토큰을 만든다. */
export function signSession(payload: Omit<AdminSession, 'exp'>): string {
  return signPayload({ ...payload }, SESSION_MAX_AGE)
}

/** 서명과 만료를 검증한다. 실패 시 null. */
export function verifySession(token: string | undefined | null): AdminSession | null {
  const parsed = verifyPayload(token)
  if (!parsed) return null
  if (typeof parsed.id !== 'string') return null
  if (parsed.role !== 'super' && parsed.role !== 'center') return null
  return {
    id: parsed.id,
    role: parsed.role,
    center_id: parsed.center_id ?? null,
    exp: parsed.exp,
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

/**
 * 해당 기관 데이터에 접근할 권한이 있는지.
 * 슈퍼관리자는 전체, 센터관리자는 본인 기관만.
 */
export function canAccessCenter(session: AdminSession, centerId: number | null): boolean {
  if (session.role === 'super') return true
  if (centerId === null) return false
  return session.center_id === centerId
}
