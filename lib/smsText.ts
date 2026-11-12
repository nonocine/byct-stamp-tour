/**
 * 문자 — 화면·서버 공용 상수·헬퍼 (서버 전용 import 금지).
 * dongrae-business-trip lib/sms/text.ts 의 규칙을 그대로 따른다.
 *   길이: EUC-KR 기준 — 비 ASCII 2바이트, ASCII 1바이트. 90바이트 초과 LMS, 2,000 초과 금지.
 */

export const SMS_MAX_BYTES = 90
export const LMS_MAX_BYTES = 2000
/** 한 번에 보낼 수 있는 최대 인원. 1,000명을 넘으면 서버가 500명씩 나눠 보낸다. */
export const SMS_MAX_RECIPIENTS = 3000
export const SMS_SPLIT_THRESHOLD = 1000
export const SMS_CHUNK_SIZE = 500

export type SmsMsgType = 'SMS' | 'LMS'

export function eucKrBytes(text: string): number {
  let n = 0
  for (const ch of text ?? '') n += (ch.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2
  return n
}

export function smsMsgType(text: string): SmsMsgType {
  return eucKrBytes(text) > SMS_MAX_BYTES ? 'LMS' : 'SMS'
}

export function normalizePhone(input: string): string {
  return (input ?? '').replace(/\D/g, '')
}

/** 휴대전화(010 + 8자리)만 받는다. */
export function isMobilePhone(digits: string): boolean {
  return /^010\d{8}$/.test(digits)
}

/** 발송 대상 그룹 */
export type SmsAudience = 'stamp_all' | 'essay_missing' | 'special_award'

export const SMS_AUDIENCE_LABEL: Record<SmsAudience, string> = {
  stamp_all: '스탬프 보유자 전체',
  essay_missing: '소감문 미작성자',
  special_award: '특별상 대상자 (스탬프 2개 이상)',
}

/** 특별상 기준 — stamp_records 기준 서로 다른 기관 스탬프 수 */
export const SPECIAL_AWARD_MIN_STAMPS = 2
