/** 참가자 세션 쿠키 제거. */
import { NextResponse, type NextRequest } from 'next/server'
import { PARTICIPANT_COOKIE, participantCookieOptions } from '@/lib/participantSession'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PARTICIPANT_COOKIE, '', { ...participantCookieOptions, maxAge: 0 })
  return res
}
