/**
 * 참가자 세션 — HMAC 서명된 HttpOnly 쿠키.
 *
 * reviews / push_subscriptions 를 RLS로 잠그면 "본인 것만" 판단을 서버가 해야 한다.
 * localStorage 의 byct_auth_profile 은 브라우저에서 위조할 수 있으므로
 * API 라우트는 이 쿠키만 신뢰한다. participant_id 는 요청 본문에서 받지 않고
 * 항상 쿠키에서 꺼낸다 — 그래야 남의 평가를 쓰거나 지울 수 없다.
 *
 * ⚠️ 서버 전용 모듈.
 */
import type { NextRequest } from 'next/server'
import { signPayload, verifyPayload } from '@/lib/sessionCrypto'

export const PARTICIPANT_COOKIE = 'byct_participant_session'

/** 참가자는 모바일에서 오래 쓰므로 30일. */
export const PARTICIPANT_SESSION_MAX_AGE = 60 * 60 * 24 * 30

export interface ParticipantSession {
  participantId: string
  exp: number
}

export function signParticipantSession(participantId: string): string {
  return signPayload(
    { participantId, kind: 'participant' },
    PARTICIPANT_SESSION_MAX_AGE,
  )
}

/** 서명·만료·필수 필드를 검증한다. 실패 시 null. */
export function verifyParticipantSession(
  token: string | undefined | null,
): ParticipantSession | null {
  const parsed = verifyPayload(token)
  if (!parsed) return null
  // 관리자 토큰을 참가자 쿠키에 넣어도 여기서 걸러진다 (participantId 부재).
  if (parsed.kind !== 'participant') return null
  if (typeof parsed.participantId !== 'string' || !parsed.participantId) return null
  return { participantId: parsed.participantId, exp: parsed.exp }
}

export function readParticipantSession(req: NextRequest): ParticipantSession | null {
  return verifyParticipantSession(req.cookies.get(PARTICIPANT_COOKIE)?.value)
}

export const participantCookieOptions = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}
