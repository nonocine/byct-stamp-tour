/**
 * 보고서 집계 데이터 — 서버에서 service_role 로 수집한다.
 *
 * 집계가 reviews / center_reports / global_plans 를 함께 읽기 때문에
 * 브라우저의 anon 클라이언트로는 더 이상 수행할 수 없다.
 * (programs / applications / stamp_records / profiles 는 아직 anon 으로도
 *  읽히지만, 어차피 서버에서 함께 읽으므로 다음 단계에서 그 테이블들을
 *  잠글 때 이 라우트는 수정이 필요 없다.)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'
import { collectCenterReportData, collectGlobalReportData } from '@/lib/reportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const scope = params.get('scope') === 'global' ? 'global' : 'center'

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[admin/report-data] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  try {
    if (scope === 'global') {
      if (session.role !== 'super') {
        return NextResponse.json(
          { error: '통합 보고서는 슈퍼관리자만 생성할 수 있습니다.' },
          { status: 403 },
        )
      }
      const data = await collectGlobalReportData(supabase)
      return NextResponse.json({ scope: 'global', data })
    }

    const centerId = Number(params.get('centerId'))
    if (!Number.isInteger(centerId)) {
      return NextResponse.json({ error: 'centerId 가 필요합니다.' }, { status: 400 })
    }
    if (!canAccessCenter(session, centerId)) {
      return NextResponse.json({ error: '본인 기관만 조회할 수 있습니다.' }, { status: 403 })
    }

    const data = await collectCenterReportData(centerId, supabase)
    return NextResponse.json({ scope: 'center', data })
  } catch (e: any) {
    console.error('[admin/report-data] 집계 실패:', e?.message ?? e)
    return NextResponse.json(
      { error: `데이터 수집에 실패했습니다: ${e?.message ?? e}` },
      { status: 500 },
    )
  }
}
