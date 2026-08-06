/**
 * 프로그램 운영계획서 PDF — 업로드/삭제.
 *
 * program-plans 버킷은 anon 의 INSERT/UPDATE/DELETE 정책을 제거했으므로
 * 파일을 이 라우트로 보내 service_role 로 올린다.
 * 예전에는 누구나 계획서를 올리거나 **기존 파일을 삭제**할 수 있었다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { canAccessCenter, readAdminSession } from '@/lib/adminSession'
import { UploadError, extractStoragePath, readUpload } from '@/lib/storageServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'program-plans'
const MAX_BYTES = 10 * 1024 * 1024

function forbidden() {
  return NextResponse.json({ error: '권한이 없습니다. 다시 로그인해주세요.' }, { status: 401 })
}

/** 대상 프로그램의 소유 기관을 확인하고 접근 권한을 검사한다. */
async function loadProgram(supabase: any, programId: string) {
  const { data, error } = await supabase
    .from('programs')
    .select('id, title, organization_id, plan_pdf_url')
    .eq('id', programId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** POST — multipart/form-data: file, programId */
export async function POST(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[programs/plan] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '업로드 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const programId = String(form.get('programId') ?? '')
  if (!programId) return NextResponse.json({ error: 'programId 가 필요합니다.' }, { status: 400 })

  let program: any
  try {
    program = await loadProgram(supabase, programId)
  } catch (e: any) {
    console.error('[programs/plan] 프로그램 조회 실패:', e?.message)
    return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 })
  }
  if (!program) return NextResponse.json({ error: '프로그램을 찾을 수 없습니다.' }, { status: 404 })
  if (!canAccessCenter(session, program.organization_id)) {
    return NextResponse.json(
      { error: '본인 기관 프로그램의 계획서만 업로드할 수 있습니다.' },
      { status: 403 },
    )
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

  const path = `programs/${programId}-${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload.buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    })

  if (upErr) {
    console.error('[programs/plan] 업로드 실패:', upErr.message)
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: dbErr } = await supabase
    .from('programs')
    .update({ plan_pdf_url: publicUrl })
    .eq('id', programId)

  if (dbErr) {
    // DB 반영이 실패하면 방금 올린 파일은 고아가 된다 — 정리한다.
    await supabase.storage.from(BUCKET).remove([path])
    console.error('[programs/plan] DB 반영 실패:', dbErr.message)
    return NextResponse.json({ error: `저장 실패: ${dbErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ plan_pdf_url: publicUrl })
}

/** DELETE /api/admin/programs/plan?programId=... */
export async function DELETE(req: NextRequest) {
  const session = readAdminSession(req)
  if (!session) return forbidden()

  const programId = req.nextUrl.searchParams.get('programId') ?? ''
  if (!programId) return NextResponse.json({ error: 'programId 가 필요합니다.' }, { status: 400 })

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[programs/plan] 서버 설정 오류:', e?.message)
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  let program: any
  try {
    program = await loadProgram(supabase, programId)
  } catch (e: any) {
    console.error('[programs/plan] 프로그램 조회 실패:', e?.message)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
  if (!program) return NextResponse.json({ error: '프로그램을 찾을 수 없습니다.' }, { status: 404 })
  if (!canAccessCenter(session, program.organization_id)) {
    return NextResponse.json(
      { error: '본인 기관 프로그램의 계획서만 삭제할 수 있습니다.' },
      { status: 403 },
    )
  }

  if (program.plan_pdf_url) {
    const path = extractStoragePath(program.plan_pdf_url, BUCKET)
    if (path) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
      if (rmErr) console.warn('[programs/plan] Storage 제거 실패:', rmErr.message)
    }
  }

  const { error: dbErr } = await supabase
    .from('programs')
    .update({ plan_pdf_url: null })
    .eq('id', programId)

  if (dbErr) {
    console.error('[programs/plan] DB 반영 실패:', dbErr.message)
    return NextResponse.json({ error: `삭제 실패: ${dbErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
