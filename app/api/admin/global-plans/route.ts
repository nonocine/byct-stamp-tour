/**
 * 전체 사업계획서 (global_plans) — 슈퍼관리자 전용.
 *
 * PDF 업로드까지 이 라우트가 담당한다. program-plans 버킷은 anon 의
 * INSERT/UPDATE/DELETE 정책을 제거했으므로 브라우저에서 직접 올릴 수 없다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readSuperAdminSession } from '@/lib/adminSession'
import { UploadError, extractStoragePath, readUpload } from '@/lib/storageServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'program-plans'
const MAX_BYTES = 20 * 1024 * 1024

function forbidden() {
  return NextResponse.json(
    { error: '슈퍼관리자 권한이 필요합니다. 다시 로그인해주세요.' },
    { status: 401 },
  )
}

function serverConfigError(e: any) {
  console.error('[admin/global-plans] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/** GET /api/admin/global-plans — 목록 */
export async function GET(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const { data, error } = await supabase
    .from('global_plans')
    .select('id, title, pdf_url, uploaded_by, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/global-plans] 조회 실패:', error.message)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ plans: data ?? [] })
}

/** POST /api/admin/global-plans — multipart/form-data: file, title, uploadedBy */
export async function POST(req: NextRequest) {
  const session = readSuperAdminSession(req)
  if (!session) return forbidden()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const title = String(form.get('title') ?? '').trim()
  const uploadedBy = String(form.get('uploadedBy') ?? '').trim()

  if (!title) {
    return NextResponse.json({ error: '계획서 제목을 입력해주세요.' }, { status: 400 })
  }

  let upload
  try {
    upload = await readUpload(form, 'file', {
      maxBytes: MAX_BYTES,
      allowed: ['application/pdf'],
      allowedExtensions: ['pdf'],
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
  } catch (e) {
    return serverConfigError(e)
  }

  const path = `global/${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, upload.buffer, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
  })

  if (upErr) {
    console.error('[admin/global-plans] 업로드 실패:', upErr.message)
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error } = await supabase
    .from('global_plans')
    .insert({ title, pdf_url: pub.publicUrl, uploaded_by: uploadedBy })

  if (error) {
    // DB 반영 실패 시 방금 올린 파일은 고아가 된다 — 정리한다.
    await supabase.storage.from(BUCKET).remove([path])
    console.error('[admin/global-plans] 저장 실패:', error.message)
    return NextResponse.json({ error: `저장에 실패했습니다: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/admin/global-plans?id=... */
export async function DELETE(req: NextRequest) {
  if (!readSuperAdminSession(req)) return forbidden()

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: '삭제할 계획서 id가 필요합니다.' }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  // Storage 파일도 함께 정리한다 (브라우저는 이제 버킷에서 삭제할 수 없다).
  const { data: plan } = await supabase
    .from('global_plans')
    .select('pdf_url')
    .eq('id', id)
    .maybeSingle()

  if (plan?.pdf_url) {
    const path = extractStoragePath(plan.pdf_url as string, BUCKET)
    if (path) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
      if (rmErr) console.warn('[admin/global-plans] Storage 제거 실패:', rmErr.message)
    }
  }

  const { error } = await supabase.from('global_plans').delete().eq('id', id)

  if (error) {
    console.error('[admin/global-plans] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
