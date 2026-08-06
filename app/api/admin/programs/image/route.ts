/**
 * 프로그램 대표 이미지 업로드 — program-images 버킷.
 *
 * 이미지 압축(canvas)은 브라우저에 남겨두고, 압축된 결과만 여기로 보낸다.
 * 업로드된 URL 을 반환하며, programs.image_url 반영은 프로그램 저장 시점에
 * /api/admin/programs 가 처리한다 (신규 생성 시에는 아직 행이 없다).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'
import { ORGANIZATIONS } from '@/lib/data'
import { UploadError, readUpload } from '@/lib/storageServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'program-images'
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const programId = String(form.get('programId') ?? '')
  const orgId = Number(form.get('orgId'))

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(programId)) {
    return NextResponse.json({ error: 'programId 가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!ORGANIZATIONS.some(o => o.id === orgId)) {
    return NextResponse.json({ error: '기관 정보가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!canAccessCenter(session, orgId)) {
    return NextResponse.json(
      { error: '본인 기관 프로그램의 이미지만 올릴 수 있습니다.' },
      { status: 403 },
    )
  }

  let upload
  try {
    upload = await readUpload(form, 'file', {
      maxBytes: MAX_BYTES,
      allowed: ['image/'],
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
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
    console.error('[programs/image] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const path = `${orgId}/${programId}-${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload.buffer, { contentType: 'image/jpeg', upsert: true })

  if (upErr) {
    console.error('[programs/image] 업로드 실패:', upErr.message)
    return NextResponse.json({ error: `이미지 업로드 실패: ${upErr.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ image_url: data.publicUrl })
}
