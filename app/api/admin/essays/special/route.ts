/**
 * 슈퍼관리자 — 특별상 대상자 (stamp_records 기준 스탬프 2개 이상).
 * 이름·전화번호·스탬프 수·받은 기관·소감문 작성 여부.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'
import { filterAudience, loadStampHolders } from '@/lib/essayServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!readSuperAdminSession(req)) {
    return NextResponse.json({ error: '슈퍼관리자만 볼 수 있습니다.' }, { status: 401 })
  }
  try {
    const holders = await loadStampHolders(getSupabaseAdmin())
    return NextResponse.json({ participants: filterAudience(holders, 'special_award') })
  } catch (e: any) {
    console.error('[admin/essays/special] 조회 실패:', e?.message)
    return NextResponse.json({ error: '명단을 불러오지 못했습니다.' }, { status: 500 })
  }
}
