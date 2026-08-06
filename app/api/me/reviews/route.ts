/**
 * 참가자 본인 평가 — 조회 / 작성·수정 / 삭제.
 *
 * participant_id 는 요청 본문에서 받지 않고 항상 세션 쿠키에서 꺼낸다.
 * 그래서 남의 평가를 읽거나 쓰거나 지울 수 없다.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { readParticipantSession } from '@/lib/participantSession'
import { ORGANIZATIONS } from '@/lib/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
}

function serverConfigError(e: any) {
  console.error('[me/reviews] 서버 설정 오류:', e?.message)
  return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
}

/**
 * GET /api/me/reviews            → 내 평가 전체
 * GET /api/me/reviews?centerId=N → 해당 기관 평가 1건 (없으면 review: null)
 */
export async function GET(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) return unauthorized()

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  const centerIdParam = req.nextUrl.searchParams.get('centerId')

  if (centerIdParam !== null) {
    const centerId = Number(centerIdParam)
    if (!Number.isInteger(centerId)) {
      return NextResponse.json({ error: 'centerId 가 올바르지 않습니다.' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, rating, comment, program_rating, leader_rating, facility_rating, wish_program, created_at',
      )
      .eq('participant_id', session.participantId)
      .eq('center_id', centerId)
      .maybeSingle()

    if (error) {
      console.error('[me/reviews] 단건 조회 실패:', error.message)
      return NextResponse.json({ error: '평가를 불러오지 못했습니다.' }, { status: 500 })
    }
    return NextResponse.json({ review: data ?? null })
  }

  const { data, error } = await supabase
    .from('reviews')
    .select('id, center_id, rating, comment')
    .eq('participant_id', session.participantId)

  if (error) {
    console.error('[me/reviews] 목록 조회 실패:', error.message)
    return NextResponse.json({ error: '평가를 불러오지 못했습니다.' }, { status: 500 })
  }
  return NextResponse.json({ reviews: data ?? [] })
}

/** POST /api/me/reviews — 내 평가 작성/수정 (기관당 1건, upsert) */
export async function POST(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 })
  }

  const centerId = Number(body.center_id)
  const org = ORGANIZATIONS.find(o => o.id === centerId)
  if (!org) {
    return NextResponse.json({ error: '기관 정보가 올바르지 않습니다.' }, { status: 400 })
  }

  function star(v: unknown): number | null {
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
  }

  const programRating = star(body.program_rating)
  const leaderRating = star(body.leader_rating)
  const facilityRating = star(body.facility_rating)

  if (!programRating || !leaderRating || !facilityRating) {
    return NextResponse.json(
      { error: '프로그램·지도자·시설 만족도를 모두 선택해주세요 (1~5점)' },
      { status: 400 },
    )
  }

  const comment =
    typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim().slice(0, 200) : null
  const wishProgram =
    typeof body.wish_program === 'string' && body.wish_program.trim()
      ? body.wish_program.trim().slice(0, 200)
      : null

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  // participant_name 은 클라이언트 값을 믿지 않고 profiles 에서 가져온다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', session.participantId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: '참가자 정보를 찾을 수 없습니다.' }, { status: 401 })
  }

  const { error } = await supabase.from('reviews').upsert(
    {
      participant_id: session.participantId,
      participant_name: profile.name,
      center_id: org.id,
      center_name: org.name,
      // 세 항목 평균을 기존 rating(정수)으로 자동 계산 — 기존 로직 유지
      rating: Math.round((programRating + leaderRating + facilityRating) / 3),
      program_rating: programRating,
      leader_rating: leaderRating,
      facility_rating: facilityRating,
      wish_program: wishProgram,
      comment,
    },
    { onConflict: 'participant_id,center_id' },
  )

  if (error) {
    console.error('[me/reviews] 저장 실패:', error.message)
    return NextResponse.json({ error: '저장에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/me/reviews?centerId=N — 내 평가 삭제 */
export async function DELETE(req: NextRequest) {
  const session = readParticipantSession(req)
  if (!session) return unauthorized()

  const centerId = Number(req.nextUrl.searchParams.get('centerId'))
  if (!Number.isInteger(centerId)) {
    return NextResponse.json({ error: 'centerId 가 필요합니다.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    return serverConfigError(e)
  }

  // participant_id 조건이 함께 걸리므로 남의 평가는 지워지지 않는다.
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('participant_id', session.participantId)
    .eq('center_id', centerId)

  if (error) {
    console.error('[me/reviews] 삭제 실패:', error.message)
    return NextResponse.json({ error: '삭제에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
