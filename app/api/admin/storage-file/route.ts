/**
 * 비공개 버킷 파일 열람 — report-photos(기관 현장 사진) · program-plans(계획서 PDF).
 *
 * GET /api/admin/storage-file?bucket=...&ref=...[&raw=1]
 *   ref = DB 에 저장된 값(버킷 안 경로, 또는 예전 공개 URL — lib/storageRef 참고)
 *   · 관리자 로그인(서명 쿠키) 필수
 *   · report-photos 는 경로 첫 칸이 기관 id({centerId}/...) — 슈퍼는 전체, 센터는 본인 기관만
 *   · program-plans 는 로그인한 관리자면 열람(지금 화면 규칙과 같음)
 *   · 기본: 1시간 서명 URL 로 302 이동 / raw=1: 서버가 내려받아 내용을 그대로 돌려줌(Word 보고서 사진)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'
import { isPrivateBucket, storageRefPath } from '@/lib/storageRef'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNED_SECONDS = 60 * 60

export async function GET(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const bucket = params.get('bucket')
  const ref = params.get('ref') ?? ''
  if (!isPrivateBucket(bucket)) {
    return NextResponse.json({ error: '열 수 없는 저장소입니다.' }, { status: 400 })
  }
  const path = storageRefPath(ref, bucket)
  if (!path) return NextResponse.json({ error: '파일 경로를 확인할 수 없습니다.' }, { status: 400 })

  if (bucket === 'report-photos') {
    const centerId = Number(path.split('/')[0])
    if (!Number.isInteger(centerId) || !canAccessCenter(session, centerId)) {
      return NextResponse.json({ error: '본인 기관의 사진만 볼 수 있습니다.' }, { status: 403 })
    }
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[storage-file] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  if (params.get('raw') === '1') {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (error || !data) {
      return NextResponse.json({ error: '파일을 찾지 못했습니다.' }, { status: 404 })
    }
    return new NextResponse(Buffer.from(await data.arrayBuffer()), {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_SECONDS)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: '파일을 찾지 못했습니다.' }, { status: 404 })
  }
  const res = NextResponse.redirect(data.signedUrl, 302)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}
