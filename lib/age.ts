// 한국식 만 나이 계산 유틸.
// birthdate 는 "YYYY-MM-DD" 또는 "YYYYMMDD" 모두 허용.
export function calculateKoreanAge(birthdate: string, today: Date = new Date()): number {
  const digits = birthdate.replace(/\D/g, '')
  if (digits.length !== 8) return NaN

  const year = parseInt(digits.slice(0, 4), 10)
  const month = parseInt(digits.slice(4, 6), 10)
  const day = parseInt(digits.slice(6, 8), 10)
  if (!year || !month || !day) return NaN

  const ty = today.getFullYear()
  const tm = today.getMonth() + 1
  const td = today.getDate()

  let age = ty - year
  if (tm < month || (tm === month && td < day)) age -= 1
  return age
}

// 오늘 기준 만 maxAgeExclusive 미만으로 제한하기 위한 input min 값(YYYY-MM-DD).
// 예: maxAgeExclusive=19, today=2026-05-14 → "2007-05-15"
// 이 값을 input min 속성에 넣으면 만 19세 이상에 해당하는 생년월일을 1차로 거른다.
export function minBirthdateForMaxAge(maxAgeExclusive = 19, today: Date = new Date()): string {
  const target = new Date(
    today.getFullYear() - maxAgeExclusive,
    today.getMonth(),
    today.getDate() + 1,
  )
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
