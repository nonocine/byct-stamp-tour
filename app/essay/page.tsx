'use client'
/**
 * 참가자 소감문 쓰기 — 한 화면에 질문 하나.
 *
 * 구조는 동래 독립탐험대(dream-road) 소감문(사진 + 글)을 따르되 초중학생용으로:
 *   기관 고르기 → 질문 4개(질문형 안내 + 큰 입력칸 + 예시 문장) → 사진 1장 → 확인·제출
 *   · 기관은 스탬프 받은 곳만. 1곳이면 자동 선택하고 그 단계를 건너뛴다.
 *   · 이미 쓴 소감문이 있으면 불러와서 고쳐 쓴다.
 *   · 쓰는 중인 글은 이 기기에 임시 저장(새로고침·뒤로가기로 날아가지 않게).
 *   · 사진은 카메라·갤러리 둘 다 고를 수 있게 capture 속성을 쓰지 않는다. 올리기 전에 압축.
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Loader2, PartyPopper, X } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import OrgIcon from '@/components/OrgIcon'
import { getOrgById } from '@/lib/data'
import { resizeImage } from '@/lib/image'
import {
  EMPTY_ESSAY,
  ESSAY_MAX_CHARS,
  ESSAY_MIN_CHARS,
  ESSAY_QUESTIONS,
  questionProblem,
  type EssayFields,
  type EssayRow,
} from '@/lib/essay'

type Center = { center_id: number; center_name: string }

const DRAFT_KEY = (pid: string) => `byct_essay_draft_${pid}`

function readDraft(pid: string): { centerId: number | null; fields: EssayFields } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(pid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function writeDraft(pid: string, v: { centerId: number | null; fields: EssayFields }) {
  try { localStorage.setItem(DRAFT_KEY(pid), JSON.stringify(v)) } catch {}
}
function clearDraft(pid: string) {
  try { localStorage.removeItem(DRAFT_KEY(pid)) } catch {}
}

const PRAISE = [
  '정말 멋진 소감문이에요!',
  '생각을 글로 표현하다니 대단해요!',
  '끝까지 써 낸 당신, 최고예요!',
]

export default function EssayPage() {
  const { profile, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [centers, setCenters] = useState<Center[]>([])
  const [saved, setSaved] = useState<EssayRow | null>(null)

  const [centerId, setCenterId] = useState<number | null>(null)
  const [fields, setFields] = useState<EssayFields>(EMPTY_ESSAY)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── 불러오기 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!profile) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        let res = await fetch('/api/me/essay', { cache: 'no-store' })
        if (res.status === 401) {
          // 세션 쿠키가 없으면 저장된 로그인 정보로 한 번 재발급 (AuthProvider 와 같은 방식)
          await fetch('/api/participant/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: profile.phone, birthdate: profile.birthdate }),
          }).catch(() => {})
          res = await fetch('/api/me/essay', { cache: 'no-store' })
        }
        const payload = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setLoadError(payload?.error ?? '소감문을 불러오지 못했어요.')
          return
        }
        const cs = (payload?.centers ?? []) as Center[]
        const essay = (payload?.essay ?? null) as EssayRow | null
        setCenters(cs)
        setSaved(essay)

        const draft = readDraft(profile.id)
        const base: EssayFields = essay
          ? { q_activity: essay.q_activity, q_memory: essay.q_memory, q_feeling: essay.q_feeling, q_message: essay.q_message }
          : EMPTY_ESSAY
        setFields(draft?.fields ?? base)
        const preferred = draft?.centerId ?? essay?.center_id ?? null
        if (preferred !== null && cs.some(c => c.center_id === preferred)) setCenterId(preferred)
        else if (cs.length === 1) setCenterId(cs[0].center_id)
      } catch {
        if (!cancelled) setLoadError('인터넷 연결을 확인해 주세요.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profile, authLoading])

  // 쓰는 중인 글 임시 저장
  useEffect(() => {
    if (!profile || loading || done) return
    writeDraft(profile.id, { centerId, fields })
  }, [profile, centerId, fields, loading, done])

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  // ── 단계 ──────────────────────────────────────────────────────────────
  const showCenterStep = centers.length > 1
  const steps = useMemo(() => {
    const s: { key: string; label: string }[] = []
    if (showCenterStep) s.push({ key: 'center', label: '기관' })
    ESSAY_QUESTIONS.forEach((q, i) => s.push({ key: q.key, label: `질문 ${i + 1}` }))
    s.push({ key: 'photo', label: '사진' })
    s.push({ key: 'review', label: '확인' })
    return s
  }, [showCenterStep])
  const current = steps[Math.min(step, steps.length - 1)]
  const question = ESSAY_QUESTIONS.find(q => q.key === current?.key)
  const centerName = centers.find(c => c.center_id === centerId)?.center_name ?? ''

  const existingPhotoUrl = removePhoto ? null : saved?.photo_url ?? null
  const shownPhoto = photoPreview ?? existingPhotoUrl

  function stepProblem(key: string): string | null {
    if (key === 'center') return centerId === null ? '어느 기관 이야기를 쓸지 골라 주세요.' : null
    const q = ESSAY_QUESTIONS.find(x => x.key === key)
    return q ? questionProblem(q, fields[q.key]) : null
  }

  function goNext() {
    const p = stepProblem(current.key)
    if (p) { setTouched(true); return }
    setTouched(false)
    setStep(s => Math.min(s + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function goBack() {
    setTouched(false)
    setStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setSubmitError(null)
    try {
      const blob = await resizeImage(file)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoBlob(blob)
      setPhotoPreview(URL.createObjectURL(blob))
      setRemovePhoto(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '사진을 준비하지 못했어요.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function dropPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoBlob(null)
    setPhotoPreview(null)
    if (saved?.photo_url) setRemovePhoto(true)
  }

  async function submit() {
    if (!profile || centerId === null) return
    const firstBad = steps.findIndex(s => stepProblem(s.key))
    if (firstBad >= 0) { setStep(firstBad); setTouched(true); return }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const fd = new FormData()
      fd.set('center_id', String(centerId))
      for (const q of ESSAY_QUESTIONS) fd.set(q.key, fields[q.key])
      if (photoBlob) fd.set('photo', photoBlob, 'essay.jpg')
      else if (removePhoto) fd.set('remove_photo', '1')

      const res = await fetch('/api/me/essay', { method: 'POST', body: fd })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setSubmitError(payload?.error ?? '저장하지 못했어요. 잠시 후 다시 해 주세요.')
        return
      }
      clearDraft(profile.id)
      setSaved(payload.essay as EssayRow)
      setPhotoBlob(null)
      setPhotoPreview(null)
      setRemovePhoto(false)
      setDone({ created: !!payload.created })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setSubmitError('인터넷 연결을 확인하고 다시 눌러 주세요. 쓴 글은 이 기기에 저장돼 있어요.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 화면: 로딩·로그인·스탬프 없음 ─────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="py-32 flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin" size={24} />
        <p className="text-sm">불러오는 중...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-amber-900 mb-2">로그인하고 소감문을 써 볼까요?</p>
          <p className="text-sm text-amber-700 mb-4">스탬프투어에 가입한 전화번호와 생년월일로 로그인해 주세요.</p>
          <Link href="/login?next=/essay" className="inline-block bg-amber-500 text-white font-bold px-6 py-3 rounded-xl">
            로그인하기 →
          </Link>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-gray-700 font-semibold mb-4">{loadError}</p>
        <button onClick={() => location.reload()} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">
          다시 불러오기
        </button>
      </div>
    )
  }

  if (centers.length === 0) {
    return (
      <div className="px-4 py-10">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-4xl mb-3">🎫</p>
          <p className="text-lg font-bold text-gray-900 mb-2">아직 받은 스탬프가 없어요</p>
          <p className="text-sm text-gray-500 mb-5">기관 프로그램에 참여하고 스탬프를 받으면 소감문을 쓸 수 있어요.</p>
          <Link href="/programs" className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">
            프로그램 보러 가기
          </Link>
        </div>
      </div>
    )
  }

  // ── 화면: 제출 완료 (칭찬) ────────────────────────────────────────────
  if (done && saved) {
    const praise = PRAISE[(profile.name.length + saved.q_feeling.length) % PRAISE.length]
    return (
      <div className="px-4 py-8 space-y-5">
        <div className="rounded-3xl p-7 text-center text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#1a3a8c,#6d4fd8)' }}>
          <PartyPopper className="mx-auto mb-3" size={48} />
          <p className="text-2xl font-black mb-2">{praise}</p>
          <p className="text-base text-white/90 leading-relaxed">
            {profile.name} 님의 소감문이 {done.created ? '잘 제출되었어요' : '잘 고쳐졌어요'}.<br />
            <b>{saved.center_name}</b> 선생님들이 읽어 볼 거예요.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 leading-relaxed">
          🏆 잘 쓴 소감문은 기관에서 <b>우수작</b>으로 뽑혀 선물을 받을 수 있어요!<br />
          더 고치고 싶으면 언제든 다시 들어와서 고칠 수 있어요.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setDone(null); setStep(0) }}
            className="py-3.5 rounded-xl bg-white border border-gray-200 font-bold text-gray-700"
          >
            다시 고치기
          </button>
          <Link href="/" className="py-3.5 rounded-xl bg-blue-600 text-white font-bold text-center">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  // ── 화면: 단계별 작성 ─────────────────────────────────────────────────
  const problem = touched ? stepProblem(current.key) : null
  const isLast = current.key === 'review'

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 머리말 */}
      <div>
        <p className="text-xs font-semibold text-blue-600">B.Y.C.T 소감문</p>
        <h1 className="text-xl font-black text-gray-900">
          {saved ? '내 소감문 고치기 ✏️' : '스탬프투어 소감문 쓰기 ✏️'}
        </h1>
        {saved && step === 0 && (
          <p className="mt-1 text-sm text-gray-500">이미 쓴 소감문을 불러왔어요. 고치고 싶은 부분만 바꿔 주세요.</p>
        )}
      </div>

      {/* 진행 단계 */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-semibold text-blue-700">{step + 1} / {steps.length} 단계 · {current.label}</span>
          <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div key={s.key} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* 기관 선택 */}
      {current.key === 'center' && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">어느 기관에서 한 활동을 써 볼까요?</h2>
          <p className="text-sm text-gray-500">스탬프를 받은 기관 중에서 가장 기억에 남는 곳 한 곳을 골라 주세요. 그 기관에서 소감문을 읽고 우수작을 뽑아요.</p>
          <div className="space-y-2">
            {centers.map(c => {
              const active = centerId === c.center_id
              return (
                <button
                  key={c.center_id}
                  onClick={() => { setCenterId(c.center_id); setTouched(false) }}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'}`}
                >
                  {getOrgById(c.center_id) && <OrgIcon org={getOrgById(c.center_id)!} size={40} />}
                  <span className="flex-1 font-bold text-gray-900">{c.center_name}</span>
                  {active && <Check className="text-blue-600" size={22} />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 질문 */}
      {question && (
        <section className="space-y-3">
          {centerName && <p className="text-xs font-semibold text-gray-400">📍 {centerName}</p>}
          <h2 className="text-xl font-black text-gray-900 leading-snug">
            {question.title}
            {!question.required && <span className="ml-1.5 text-sm font-semibold text-gray-400">(선택)</span>}
          </h2>
          <p className="text-sm text-gray-500">{question.hint}</p>
          <textarea
            value={fields[question.key]}
            onChange={e => setFields(f => ({ ...f, [question.key]: e.target.value }))}
            maxLength={ESSAY_MAX_CHARS}
            rows={9}
            placeholder={question.placeholder}
            // 16px 이상이어야 iOS 가 입력할 때 화면을 확대하지 않는다
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 text-[17px] leading-relaxed text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500"
          />
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              {question.required ? `${ESSAY_MIN_CHARS}자 이상 써 주세요` : '안 써도 괜찮아요'}
            </span>
            <span className={fields[question.key].trim().length >= ESSAY_MIN_CHARS || !question.required ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
              {fields[question.key].length} / {ESSAY_MAX_CHARS}자
            </span>
          </div>
        </section>
      )}

      {/* 사진 */}
      {current.key === 'photo' && (
        <section className="space-y-3">
          <h2 className="text-xl font-black text-gray-900">활동 사진이 있으면 1장 올려 볼까요?</h2>
          <p className="text-sm text-gray-500">사진을 바로 찍거나 앨범에서 고를 수 있어요. 사진이 없어도 괜찮아요.</p>
          {shownPhoto ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shownPhoto} alt="첨부한 사진" className="w-full max-h-96 object-contain rounded-2xl bg-gray-100" />
              <button
                onClick={dropPhoto}
                aria-label="사진 빼기"
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-700 font-bold flex items-center justify-center gap-2"
              >
                <ImagePlus size={18} /> 다른 사진으로 바꾸기
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 flex flex-col items-center justify-center gap-2 text-blue-700"
            >
              {photoBusy ? <Loader2 className="animate-spin" size={36} /> : <Camera size={40} />}
              <span className="font-bold">{photoBusy ? '사진 준비 중...' : '사진 찍기 / 앨범에서 고르기'}</span>
            </button>
          )}
          {/* capture 속성을 쓰지 않는다 — 카메라와 갤러리 둘 다 고를 수 있게 */}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
        </section>
      )}

      {/* 확인 */}
      {current.key === 'review' && (
        <section className="space-y-3">
          <h2 className="text-xl font-black text-gray-900">거의 다 했어요! 한 번 읽어 볼까요?</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <p className="text-sm font-bold text-blue-700">📍 {centerName}</p>
            {shownPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownPhoto} alt="" className="w-full max-h-64 object-contain rounded-xl bg-gray-50" />
            )}
            {ESSAY_QUESTIONS.filter(q => fields[q.key].trim()).map(q => (
              <div key={q.key}>
                <p className="text-xs font-bold text-gray-400 mb-1">{q.title}</p>
                <p className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">{fields[q.key].trim()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">고치고 싶은 곳이 있으면 '이전'을 눌러 돌아갈 수 있어요.</p>
        </section>
      )}

      {problem && <p role="alert" className="text-sm font-bold text-orange-600">{problem}</p>}
      {submitError && <p role="alert" className="text-sm font-bold text-red-600">{submitError}</p>}

      {/* 버튼 */}
      <div className="flex gap-3 pt-1">
        {step > 0 && (
          <button
            onClick={goBack}
            disabled={submitting}
            className="flex-1 py-4 rounded-2xl bg-white border border-gray-200 font-bold text-gray-700 flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={18} /> 이전
          </button>
        )}
        {isLast ? (
          <button
            onClick={submit}
            disabled={submitting || photoBusy}
            className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white text-lg font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? <><Loader2 className="animate-spin" size={20} /> 보내는 중...</> : saved ? '고친 내용 저장하기' : '소감문 제출하기 🎉'}
          </button>
        ) : (
          <button
            onClick={goNext}
            disabled={photoBusy}
            className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {current.key === 'photo' && !shownPhoto ? '사진 없이 다음' : '다음'} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
