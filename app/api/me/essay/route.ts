/**
 * 참가자 본인 소감문 — 조회 / 작성·수정 (1인 1편).
 *
 * participant_id 는 요청 본문에서 받지 않고 항상 세션 쿠키에서 꺼낸다.
 * 기관은 본인이 스탬프를 받은 기관만 고를 수 있다 (서버에서 다시 확인).
 * 사진은 브라우저에서 압축한 JPEG 을 받아 service_role 로 essay-photos 버킷에 올린다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readParticipantSession } from '@/lib/participantSession'
import { UploadError, readUpload } from '@/lib/storageServer'
import { ESSAY_BUCKET, ESSAY_QUESTIONS, questionProblem, type EssayFields } from '@/lib/essay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024

const COLUMNS =
  'id, participant_id, participant_name, center_id, center_name, q_activity, q_memory, q_feeling, q_message, photo_url, is_excellent, created_at, updated_at'

function unauthorized() {
  return NextResponse.json({ error: '로그인이 필요해요. 다시 로그인해 주세요.' }, { status: 401 })
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

async function stampedCenters(supabase: ReturnType<typeof getSupabaseAdmin>, participantId: string) {
  const { data, error } = await supabase
    .from('stamp_records')
    .select('center_id, center_name, stamped_at')
    .eq('participant_id', participantId)
    .order('stamped_at', { ascending: true })
  if (error) throw new Error(error.message)
  const seen = new Map<number, { center_id: number; center_name: string }>()
  for (const r of data ?? []) {
    if (!seen.has(r.center_id)) seen.set(r.center_id, { center_id: r.center_id, center_name: r.center_name })
  }
  return [...seen.values()]
}

/** 공개 URL → 버킷 안 경로 (옛 사진 지우기용) */
function pathFromPublicUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${ESSAY_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  const p = decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  return p && !p.includes('..') ? p : null
}

/** GET /api/me/essay → { essay | null, centers: 스탬프 받은 기관들 } */
export async function GET(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) return unauthorized()

  try {
    const supabase = getSupabaseAdmin()
    const [centers, essayRes] = await Promise.all([
      stampedCenters(supabase, session.participantId),
      supabase.from('essays').select(COLUMNS).eq('participant_id', session.participantId).maybeSingle(),
    ])
    if (essayRes.error) throw new Error(essayRes.error.message)
    return NextResponse.json({ essay: essayRes.data ?? null, centers })
  } catch (e: any) {
    console.error('[me/essay] 조회 실패:', e?.message)
    return fail(500, '소감문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
}

/**
 * POST /api/me/essay (multipart/form-data)
 *   center_id, q_activity, q_memory, q_feeling, q_message
 *   photo (선택, image/jpeg)  ·  remove_photo=1 (사진 빼기)
 */
export async function POST(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요. 다시 시도해 주세요.')
  }

  const fields = {} as EssayFields
  for (const q of ESSAY_QUESTIONS) {
    const v = String(form.get(q.key) ?? '').trim()
    const problem = questionProblem(q, v)
    if (problem) return fail(400, `"${q.title}" — ${problem}`)
    fields[q.key] = v
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e: any) {
    console.error('[me/essay] 서버 설정 오류:', e?.message)
    return fail(500, '서버 설정 오류입니다.')
  }

  try {
    const centerId = Number(form.get('center_id'))
    const centers = await stampedCenters(supabase, session.participantId)
    const center = centers.find(c => c.center_id === centerId)
    if (!center) return fail(400, '스탬프를 받은 기관 중에서 골라 주세요.')

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', session.participantId)
      .maybeSingle()
    if (!profile) return unauthorized()

    const { data: existing, error: exErr } = await supabase
      .from('essays')
      .select('id, center_id, photo_url, is_excellent')
      .eq('participant_id', session.participantId)
      .maybeSingle()
    if (exErr) throw new Error(exErr.message)

    // 사진
    let photoUrl: string | null = existing?.photo_url ?? null
    let oldPhotoToDelete: string | null = null
    const hasNewPhoto = form.get('photo') instanceof File && (form.get('photo') as File).size > 0
    if (hasNewPhoto) {
      let upload
      try {
        upload = await readUpload(form, 'photo', {
          maxBytes: PHOTO_MAX_BYTES,
          allowed: ['image/'],
          allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        })
      } catch (e) {
        if (e instanceof UploadError) return fail(e.status, e.message)
        throw e
      }
      // 경로에 추측할 수 없는 uuid — 공개 버킷이라 주소를 아는 사람만 볼 수 있게.
      const path = `${session.participantId}/${randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from(ESSAY_BUCKET)
        .upload(path, upload.buffer, { contentType: 'image/jpeg', upsert: false })
      if (upErr) {
        console.error('[me/essay] 사진 업로드 실패:', upErr.message)
        return fail(500, '사진을 올리지 못했어요. 사진 없이 먼저 저장하거나 잠시 후 다시 해 주세요.')
      }
      oldPhotoToDelete = pathFromPublicUrl(photoUrl)
      photoUrl = supabase.storage.from(ESSAY_BUCKET).getPublicUrl(path).data.publicUrl
    } else if (form.get('remove_photo') === '1') {
      oldPhotoToDelete = pathFromPublicUrl(photoUrl)
      photoUrl = null
    }

    // 기관을 바꾸면 그 기관이 다시 골라야 하므로 우수작 선정을 풀어 둔다.
    const centerChanged = existing && existing.center_id !== center.center_id
    const row = {
      participant_id: session.participantId,
      participant_name: profile.name,
      participant_phone: String(profile.phone ?? '').replace(/\D/g, ''),
      center_id: center.center_id,
      center_name: center.center_name,
      ...fields,
      photo_url: photoUrl,
      ...(centerChanged ? { is_excellent: false, excellent_by: null, excellent_at: null } : {}),
    }

    const { data: saved, error } = await supabase
      .from('essays')
      .upsert(row, { onConflict: 'participant_id' })
      .select(COLUMNS)
      .single()
    if (error) throw new Error(error.message)

    if (oldPhotoToDelete) {
      await supabase.storage.from(ESSAY_BUCKET).remove([oldPhotoToDelete]).catch(() => {})
    }

    return NextResponse.json({ ok: true, essay: saved, created: !existing })
  } catch (e: any) {
    console.error('[me/essay] 저장 실패:', e?.message)
    return fail(500, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
}
