/**
 * 기관 현장 사진 — report-photos 버킷.
 *
 * 쓰기 권한은 본인 기관 센터관리자만 (center_reports 저장 규칙과 동일).
 * 예전에는 anon 에게 INSERT/UPDATE/DELETE 가 전면 허용되어 있어 누구나
 * 다른 기관의 현장 사진을 올리거나 삭제할 수 있었다.
 *
 * photo_urls 배열 반영은 /api/admin/center-report(PUT) 이 담당한다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readAdminSession } from '@/lib/adminSession'
import { UploadError, extractStoragePath, readUpload, safeExtension } from '@/lib/storageServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'report-photos'
const MAX_BYTES = 10 * 1024 * 1024

/** 사진 쓰기는 본인 기관 담당지도자만 (슈퍼관리자는 읽기 전용). */
function canWrite(req: NextRequest, centerId: number): boolean {
  const session = readAdminSession(req)
  return !!session && session.role === 'center' && session.center_id === centerId
}

/** POST — multipart/form-data: file, centerId */
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const centerId = Number(form.get('centerId'))
  if (!Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 필요합니다.' }, { status: 400 })
  }
  if (!canWrite(req, centerId)) {
    return NextResponse.json(
      { error: '본인 기관의 담당지도자만 사진을 올릴 수 있습니다.' },
      { status: 403 },
    )
  }

  let upload
  try {
    upload = await readUpload(form, 'file', {
      maxBytes: MAX_BYTES,
      allowed: ['image/'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'],
    })
  } catch (e: any) {
    if (e instanceof UploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[report-photos] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const ext = safeExtension(upload.filename, 'jpg')
  const path = `${centerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, upload.buffer, {
    contentType: upload.contentType,
    cacheControl: '3600',
    upsert: false,
  })

  if (upErr) {
    console.error('[report-photos] 업로드 실패:', upErr.message)
    return NextResponse.json({ error: `사진 업로드 실패: ${upErr.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}

/** DELETE /api/admin/report-photos?centerId=N&url=... */
export async function DELETE(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const centerId = Number(params.get('centerId'))
  const url = params.get('url') ?? ''

  if (!Number.isInteger(centerId) || !url) {
    return NextResponse.json({ error: 'centerId 와 url 이 필요합니다.' }, { status: 400 })
  }
  if (!canWrite(req, centerId)) {
    return NextResponse.json(
      { error: '본인 기관의 담당지도자만 사진을 삭제할 수 있습니다.' },
      { status: 403 },
    )
  }

  const path = extractStoragePath(url, BUCKET)
  if (!path) {
    return NextResponse.json({ error: '사진 경로를 확인할 수 없습니다.' }, { status: 400 })
  }
  // 다른 기관 폴더의 파일을 지우려는 시도를 막는다.
  if (!path.startsWith(`${centerId}/`)) {
    return NextResponse.json({ error: '본인 기관의 사진이 아닙니다.' }, { status: 403 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[report-photos] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.warn('[report-photos] Storage 제거 실패:', error.message)
    // 파일이 이미 없을 수도 있다 — photo_urls 정리는 계속 진행할 수 있게 ok 처리
  }

  return NextResponse.json({ ok: true })
}
