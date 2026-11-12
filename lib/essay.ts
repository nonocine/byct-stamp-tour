/**
 * 소감문 — 화면·서버 공용 규칙 (서버 전용 import 금지).
 *
 * 구조는 동래 독립탐험대(dream-road) 소감문의 "사진 + 글"을 따르되,
 * 초중학생이 빈 칸 앞에서 막히지 않도록 글을 질문 4개로 나눴다.
 * 한 화면에 질문 하나 — 진행 단계가 보이고, 예시 문장이 placeholder 로 깔린다.
 */

export type EssayField = 'q_activity' | 'q_memory' | 'q_feeling' | 'q_message'

export interface EssayQuestion {
  key: EssayField
  title: string        // 질문 (큰 글씨)
  hint: string         // 질문 아래 도움말
  placeholder: string  // 예시 문장
  required: boolean
}

export const ESSAY_QUESTIONS: EssayQuestion[] = [
  {
    key: 'q_activity',
    title: '어떤 활동을 했나요?',
    hint: '프로그램 이름이나, 그곳에서 한 일을 순서대로 떠올려 보세요.',
    placeholder: '예) 청소년수련관에서 친구들과 함께 클라이밍 체험을 했어요. 처음에는 선생님께 안전 수칙을 배우고…',
    required: true,
  },
  {
    key: 'q_memory',
    title: '가장 기억에 남는 순간은 언제였나요?',
    hint: '웃겼던 일, 놀랐던 일, 뿌듯했던 일 무엇이든 좋아요.',
    placeholder: '예) 꼭대기까지 올라가서 종을 쳤을 때가 제일 기억에 남아요. 아래에서 친구들이 박수를 쳐 줬거든요.',
    required: true,
  },
  {
    key: 'q_feeling',
    title: '활동하면서 어떤 생각이나 느낌이 들었나요?',
    hint: '활동 전과 후에 마음이 어떻게 달라졌는지 써 보세요.',
    placeholder: '예) 처음엔 무서워서 포기하고 싶었는데, 끝까지 해내니까 나도 할 수 있다는 자신감이 생겼어요.',
    required: true,
  },
  {
    key: 'q_message',
    title: '다음에 해 보고 싶은 것이나 하고 싶은 말이 있나요?',
    hint: '친구에게 추천하는 말, 선생님께 하고 싶은 말도 좋아요. (안 써도 괜찮아요)',
    placeholder: '예) 다음에는 동생이랑 같이 와서 다른 프로그램도 해 보고 싶어요. 선생님 감사합니다!',
    required: false,
  },
]

/** 필수 질문 최소 글자 수 — 한 단어로 끝내지 않을 만큼만 */
export const ESSAY_MIN_CHARS = 10
export const ESSAY_MAX_CHARS = 1000

export interface EssayFields {
  q_activity: string
  q_memory: string
  q_feeling: string
  q_message: string
}

export const EMPTY_ESSAY: EssayFields = { q_activity: '', q_memory: '', q_feeling: '', q_message: '' }

/** 한 질문의 문제점. 없으면 null */
export function questionProblem(q: EssayQuestion, value: string): string | null {
  const len = value.trim().length
  if (len > ESSAY_MAX_CHARS) return `${ESSAY_MAX_CHARS}자까지 쓸 수 있어요.`
  if (q.required && len < ESSAY_MIN_CHARS) return `조금만 더 써 볼까요? (${ESSAY_MIN_CHARS}자 이상)`
  return null
}

/** 저장된 소감문 (관리자·참가자 화면 공용) */
export interface EssayRow extends EssayFields {
  id: string
  participant_id: string
  participant_name: string
  participant_phone?: string
  center_id: number
  center_name: string
  photo_url: string | null
  is_excellent: boolean
  excellent_by: string | null
  excellent_at: string | null
  created_at: string
  updated_at: string
}

export const ESSAY_BUCKET = 'essay-photos'

/** 문자에 넣는 소감문 작성 링크 */
export const ESSAY_WRITE_URL = 'https://byct-stamp-tour.vercel.app/essay'
