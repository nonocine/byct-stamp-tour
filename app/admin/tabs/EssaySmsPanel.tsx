'use client'
/**
 * 슈퍼관리자 — 문자 공지.
 *   대상 선택 → 예상 인원(번호 중복 제거) → 문구 + 소감문 링크 → 테스트 발송 성공 → 전체 발송(확인창).
 * 테스트 발송 후 문구를 한 글자라도 고치면 다시 테스트해야 한다(서버도 같은 규칙으로 막음).
 */
import { useEffect, useRef, useState } from 'react'
import { Link2, Loader2, Send, ShieldCheck } from 'lucide-react'
import { ESSAY_WRITE_URL } from '@/lib/essay'
import {
  LMS_MAX_BYTES,
  SMS_AUDIENCE_LABEL,
  SMS_MAX_BYTES,
  eucKrBytes,
  isMobilePhone,
  normalizePhone,
  smsMsgType,
  type SmsAudience,
} from '@/lib/smsText'
import { formatPhone } from './shared'

const DEFAULT_TEXT = `[B.Y.C.T 스탬프투어]
스탬프투어에 참여해 주셔서 고맙습니다!
활동 소감문을 남겨 주세요. 기관별 우수작은 선물을 드려요.

▶ 소감문 쓰기
${ESSAY_WRITE_URL}`

const AUDIENCES = Object.keys(SMS_AUDIENCE_LABEL) as SmsAudience[]

function isNightKst(): boolean {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date()))
  return h >= 21 || h < 8
}

export default function EssaySmsPanel() {
  const [audience, setAudience] = useState<SmsAudience>('essay_missing')
  const [preview, setPreview] = useState<{ people: number; phones: number; invalid: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [text, setText] = useState(DEFAULT_TEXT)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [testNumber, setTestNumber] = useState('')
  const [testing, setTesting] = useState(false)
  const [testToken, setTestToken] = useState<string | null>(null)
  const [testedText, setTestedText] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    fetch('/api/admin/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', audience }),
    })
      .then(async res => {
        const p = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) { setPreviewError(p?.error ?? '대상을 불러오지 못했습니다.'); setPreview(null); return }
        setPreview(p)
      })
      .catch(() => { if (!cancelled) setPreviewError('네트워크 오류') })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [audience])

  const trimmed = text.trim()
  const bytes = eucKrBytes(trimmed)
  const msgType = smsMsgType(trimmed)
  const tooLong = bytes > LMS_MAX_BYTES
  const testedOk = !!testToken && testedText === trimmed
  const canSendAll = testedOk && !!preview && preview.phones > 0 && !sending && !tooLong

  function insertLink() {
    const el = textRef.current
    const insert = (text.endsWith('\n') || text === '' ? '' : '\n') + ESSAY_WRITE_URL
    if (!el) { setText(t => t + insert); return }
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const piece = start === text.length ? insert : ESSAY_WRITE_URL
    const next = text.slice(0, start) + piece + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + piece.length
      el.setSelectionRange(pos, pos)
    })
  }

  async function sendTest() {
    const num = normalizePhone(testNumber)
    if (!isMobilePhone(num)) { setTestMsg({ ok: false, text: '010으로 시작하는 휴대전화 번호를 입력하세요.' }); return }
    if (!trimmed || tooLong) return
    setTesting(true)
    setTestMsg(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', text: trimmed, testNumber: num }),
      })
      const p = await res.json().catch(() => null)
      if (!res.ok) {
        setTestToken(null)
        setTestMsg({ ok: false, text: p?.error ?? '테스트 발송에 실패했습니다.' })
        return
      }
      setTestToken(p.testToken)
      setTestedText(trimmed)
      setTestMsg({ ok: true, text: `${formatPhone(num)}로 테스트 문자(${p.msg_type})를 보냈습니다. 휴대폰에서 내용과 링크를 확인한 뒤 전체 발송하세요.` })
    } catch {
      setTestMsg({ ok: false, text: '네트워크 오류로 테스트 발송에 실패했습니다.' })
    } finally {
      setTesting(false)
    }
  }

  async function sendAll() {
    if (!canSendAll || !preview) return
    const night = isNightKst() ? '\n\n⚠️ 지금은 밤 9시~아침 8시입니다. 늦은 시간 발송이 맞는지 확인하세요.' : ''
    const ok = confirm(
      `${SMS_AUDIENCE_LABEL[audience]}에게 문자를 보냅니다.\n\n` +
      `· 받는 번호: ${preview.phones.toLocaleString()}개 (${preview.people.toLocaleString()}명)\n` +
      `· 종류: ${msgType} (${bytes}바이트)\n\n` +
      `보낸 뒤에는 취소할 수 없습니다. 보낼까요?${night}`,
    )
    if (!ok) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', audience, text: trimmed, testToken }),
      })
      const p = await res.json().catch(() => null)
      if (!res.ok) { setResult({ ok: false, text: p?.error ?? '발송에 실패했습니다.' }); return }
      setResult({
        ok: true,
        text: `발송 요청 완료 — ${p.total}개 번호 중 성공 ${p.sent} · 실패 ${p.failed}${p.partial ? `\n일부 실패: ${p.partial}` : ''}`,
      })
      // 같은 문구로 실수로 두 번 보내지 않도록 테스트 확인을 초기화
      setTestToken(null)
      setTestedText(null)
    } catch {
      setResult({ ok: false, text: '네트워크 오류 — 실제로 발송되었는지 문자 이력을 먼저 확인한 뒤 다시 시도하세요.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. 대상 */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <p className="text-sm font-bold text-gray-900">1. 받는 사람</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {AUDIENCES.map(a => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`py-2.5 px-2 rounded-xl text-sm font-semibold border-2 ${audience === a ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-100 bg-white text-gray-600'}`}
            >
              {SMS_AUDIENCE_LABEL[a]}
            </button>
          ))}
        </div>
        <div className="text-sm">
          {previewLoading ? (
            <span className="text-gray-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> 인원 계산 중...</span>
          ) : previewError ? (
            <span className="text-red-600 font-semibold">{previewError}</span>
          ) : preview ? (
            <p className="text-gray-700">
              예상 발송 <b className="text-indigo-700 text-base">{preview.phones.toLocaleString()}건</b>
              <span className="text-gray-500"> · 대상 {preview.people.toLocaleString()}명 (같은 번호 중복 제거)</span>
              {preview.invalid > 0 && <span className="text-orange-600"> · 휴대전화 아님 {preview.invalid}명 제외</span>}
            </p>
          ) : null}
        </div>
      </section>

      {/* 2. 문구 */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">2. 문구</p>
          <button onClick={insertLink} className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
            <Link2 size={13} /> 소감문 작성 링크 넣기
          </button>
        </div>
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={9}
          className="w-full rounded-xl border border-gray-200 px-3 py-3 text-[15px] leading-relaxed outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{trimmed.length}자 · {bytes.toLocaleString()} / {bytes > SMS_MAX_BYTES ? LMS_MAX_BYTES.toLocaleString() : SMS_MAX_BYTES}바이트</span>
          <span className={`font-bold px-2 py-0.5 rounded ${tooLong ? 'bg-red-100 text-red-700' : msgType === 'SMS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
            {tooLong ? '너무 김' : msgType === 'SMS' ? 'SMS (단문)' : 'LMS (장문)'}
          </span>
        </div>
        <p className="text-xs text-gray-400">한글 45자(90바이트)를 넘으면 장문(LMS)으로 보내지고 요금이 더 듭니다.</p>
      </section>

      {/* 3. 테스트 */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <p className="text-sm font-bold text-gray-900">3. 테스트 발송 (내 번호로 먼저 받아 보기)</p>
        <div className="flex gap-2">
          <input
            value={formatPhone(testNumber)}
            onChange={e => setTestNumber(normalizePhone(e.target.value))}
            inputMode="numeric"
            placeholder="010-0000-0000"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] outline-none focus:border-indigo-500"
          />
          <button
            onClick={sendTest}
            disabled={testing || !trimmed || tooLong}
            className="px-4 rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} 테스트 발송
          </button>
        </div>
        {testMsg && <p className={`text-sm font-semibold ${testMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{testMsg.text}</p>}
        {testToken && testedText !== trimmed && (
          <p className="text-sm font-semibold text-orange-600">테스트 후 문구가 바뀌었습니다. 바뀐 문구로 다시 테스트해 주세요.</p>
        )}
      </section>

      {/* 4. 전체 발송 */}
      <section className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <p className="text-sm font-bold text-gray-900">4. 전체 발송</p>
        <button
          onClick={sendAll}
          disabled={!canSendAll}
          className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending
            ? '보내는 중...'
            : preview
              ? `${SMS_AUDIENCE_LABEL[audience]} ${preview.phones.toLocaleString()}건 발송`
              : '전체 발송'}
        </button>
        {!testedOk && <p className="text-xs text-gray-400 text-center">이 문구로 테스트 발송에 성공해야 버튼이 켜집니다.</p>}
        {result && <p className={`text-sm font-semibold whitespace-pre-wrap ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.text}</p>}
      </section>
    </div>
  )
}
