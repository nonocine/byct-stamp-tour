/** 관리자 세션 쿠키 제거. */
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/adminSession'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
