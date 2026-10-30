import type { CenterReportData, GlobalReportData, AgeGroups } from './reportData'
import { storageViewUrl } from '@/lib/storageRef'

// 계획서 링크 — 비공개 버킷이라 앱 열람 경로(관리자 로그인 필요)로 보낸다.
// Word 로 내려받은 문서에서도 눌리도록 절대 주소.
const planLink = (ref: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}${storageViewUrl('program-plans', ref)}`

function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}
function todayKorean(): string {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function satisfactionComment(avg: number | null): string {
  if (avg === null) return '아직 평가가 누적되지 않았습니다. 참여자에게 평가를 독려해주세요.'
  if (avg >= 4.5) return '**매우 높은 만족도**를 보이고 있습니다. 현재 운영 방식을 유지/확대를 권장합니다.'
  if (avg >= 4.0) return '**양호한 만족도**입니다. 일부 한줄평을 참고하여 세부 개선 시 우수 사례로 발전 가능합니다.'
  return '**만족도 개선이 필요**합니다. 한줄평을 자세히 검토하여 운영 방식을 보완해주세요.'
}

function ageDistRows(ag: AgeGroups): string {
  const total = ag.under10 + ag.age10to13 + ag.age14to16 + ag.age17to19 + ag.age20plus + ag.unknown
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%'
  return [
    `| 10세 미만 | ${fmtNum(ag.under10)}명 | ${pct(ag.under10)} |`,
    `| 10–13세 (초등 고학년) | ${fmtNum(ag.age10to13)}명 | ${pct(ag.age10to13)} |`,
    `| 14–16세 (중학생) | ${fmtNum(ag.age14to16)}명 | ${pct(ag.age14to16)} |`,
    `| 17–19세 (고등학생) | ${fmtNum(ag.age17to19)}명 | ${pct(ag.age17to19)} |`,
    `| 20세 이상 | ${fmtNum(ag.age20plus)}명 | ${pct(ag.age20plus)} |`,
    `| 미확인 | ${fmtNum(ag.unknown)}명 | ${pct(ag.unknown)} |`,
  ].join('\n')
}

export function generateCenterReport(data: CenterReportData): string {
  const o = data.organization

  const programsTable = data.programs.length > 0
    ? `| 프로그램명 | 일정 | 대상 | 참여 인원 | 계획서 |
| --- | --- | --- | --- | --- |
${data.programs
  .map(
    p =>
      `| ${p.title} | ${p.date ?? '-'} ${p.time ?? ''} | ${p.target || '-'} | ${fmtNum(p.participants)}명 | ${p.hasPlanPdf ? '✅' : '-'} |`,
  )
  .join('\n')}${data.unmatchedStamps > 0 ? `\n\n> 회차를 특정할 수 없는 스탬프 ${fmtNum(data.unmatchedStamps)}건은 프로그램별 참여 인원에서 제외되었습니다.` : ''}`
    : '> 등록된 프로그램이 없습니다.'

  const commentsBlock = data.satisfaction.comments.length > 0
    ? data.satisfaction.comments
        .map(c => `- ⭐${c.rating} — ${c.comment}${c.name ? ` _(${c.name})_` : ''}`)
        .join('\n')
    : '> 한줄평이 없습니다.'

  const fmtScore = (n: number | null) => (n !== null ? `⭐ ${n.toFixed(1)} / 5.0` : '평가 없음')

  const wishesBlock = data.satisfaction.wishes.length > 0
    ? data.satisfaction.wishes.map(w => `- ${w}`).join('\n')
    : '> 제안된 희망 프로그램이 없습니다.'

  const timelineBlock = data.timeline.length > 0
    ? `| 일자 | 스탬프 |
| --- | --- |
${data.timeline.map(t => `| ${t.date} | ${fmtNum(t.stamps)} |`).join('\n')}`
    : '> 활동 기록이 아직 없습니다.'

  return `# ${o.name} 결과보고서

> 생성일: ${todayKorean()}

## 1. 기관 개요

| 항목 | 내용 |
| --- | --- |
| 기관명 | ${o.name} |
| 위치 | ${o.location} |
| 카테고리 | ${o.category} |
| 소개 | ${o.description} |

## 2. 프로그램 운영 현황

총 **${fmtNum(data.programs.length)}개** 프로그램이 등록되어 있으며, 그중 ${fmtNum(data.programs.filter(p => p.hasPlanPdf).length)}개에 계획서 PDF가 첨부되어 있습니다.

${programsTable}

## 3. 참여 현황

- 실제 참여 인원: **${fmtNum(data.stamps.uniqueParticipants)}명** (스탬프 발급 기준, 중복 제거)
- 발급된 스탬프 수: **${fmtNum(data.stamps.total)}건**

## 4. 참여자 연령 분포

| 연령대 | 인원 | 비율 |
| --- | --- | --- |
${ageDistRows(data.ageGroups)}

## 5. 만족도

- 누적 평가 수: ${fmtNum(data.satisfaction.count)}건

| 항목 | 평균 점수 |
| --- | --- |
| 프로그램 만족도 | ${fmtScore(data.satisfaction.programAvg)} |
| 지도자 만족도 | ${fmtScore(data.satisfaction.leaderAvg)} |
| 시설 만족도 | ${fmtScore(data.satisfaction.facilityAvg)} |
| **종합 평균** | **${fmtScore(data.satisfaction.avg)}** |

> ${satisfactionComment(data.satisfaction.avg)}

### 한줄평 (최신 ${data.satisfaction.comments.length}건)

${commentsBlock}

### 희망 프로그램

${wishesBlock}

## 6. 일자별 추이 (최근 ${data.timeline.length}일)

${timelineBlock}

## 7. 종합 의견

- 만족도 ${data.satisfaction.avg !== null ? `${data.satisfaction.avg.toFixed(1)}점` : '평가 없음'}: ${satisfactionComment(data.satisfaction.avg).replace(/\*\*/g, '')}
- 차회 운영 시 참고할 점: 한줄평 상위 항목을 검토하여 운영에 반영해주세요.

### 담당지도자 종합의견

${data.leaderOpinion ? `> ${data.leaderOpinion.replace(/\n/g, '\n> ')}` : '> 작성된 종합의견이 없습니다.'}
`
}

export function generateGlobalReport(data: GlobalReportData): string {
  const t = data.totals

  const topStamps = data.centerRankings.byStamps.slice(0, 10)
  const topStampsTable = `| 순위 | 기관 | 스탬프 |
| --- | --- | --- |
${topStamps.map((r, i) => `| ${i + 1} | ${r.name} | ${fmtNum(r.count)} |`).join('\n')}`

  const topRating = data.centerRankings.byRating.slice(0, 10)
  const topRatingTable = topRating.length > 0
    ? `| 순위 | 기관 | 평균 별점 | 평가 수 |
| --- | --- | --- | --- |
${topRating.map((r, i) => `| ${i + 1} | ${r.name} | ⭐ ${r.avg.toFixed(1)} | ${fmtNum(r.count)} |`).join('\n')}`
    : '> 평가가 누적되지 않았습니다.'

  const programSummaryTable = `| 일자 | 기관 | 프로그램명 | 스탬프 | 별점 |
| --- | --- | --- | --- | --- |
${data.programSummary
  .map(
    r =>
      `| ${r.dates.length > 0 ? r.dates.join('<br>') : '-'} | ${r.centerName} | ${r.programTitle} | ${fmtNum(r.stamps)} | ${r.avgRating !== null ? `⭐${r.avgRating.toFixed(1)}` : '-'} |`,
  )
  .join('\n')}`

  const st = data.programSummaryTotals
  const programSummaryTotalsLine = `> **합계** — 총 스탬프 ${fmtNum(st.stamps)}건 · 총 프로그램 ${fmtNum(st.programs)}개 · 참여 기관 ${fmtNum(st.centers)}곳 · 전체 평균 별점 ${st.avgRating !== null ? `⭐ ${st.avgRating.toFixed(1)}` : '평가 없음'}`

  const planBlock = data.latestGlobalPlan
    ? `> **최신 전체 계획서**: ${data.latestGlobalPlan.title} _(업로드: ${data.latestGlobalPlan.uploadedBy})_
>
> [PDF 보기 →](${planLink(data.latestGlobalPlan.pdfUrl)})`
    : '> 등록된 전체 계획서가 없습니다.'

  let totalRatingSum = 0
  let totalRatingCount = 0
  for (const r of data.centerRankings.byRating) {
    totalRatingSum += r.avg * r.count
    totalRatingCount += r.count
  }
  const overallAvg = totalRatingCount > 0 ? totalRatingSum / totalRatingCount : null

  return `# B.Y.C.T 스탬프투어 통합 결과보고서

> 생성일: ${todayKorean()}

${planBlock}

## 1. 전체 요약

| 항목 | 수치 |
| --- | --- |
| 참여 기관 | ${fmtNum(t.organizations)}개 |
| 등록 프로그램 | ${fmtNum(t.programs)}개 |
| 실제 참여 인원 | ${fmtNum(t.uniqueParticipants)}명 (스탬프 발급 기준, 중복 제거) |
| 발급 스탬프 | ${fmtNum(t.stamps)}건 |
| 전체 평균 별점 | ${overallAvg !== null ? `⭐ ${overallAvg.toFixed(1)} / 5.0` : '평가 없음'} |

> ${satisfactionComment(overallAvg)}

## 2. 기관별 종합 통계

${programSummaryTable}

${programSummaryTotalsLine}

## 3. 스탬프 발급 순위 (Top ${topStamps.length})

${topStampsTable}

## 4. 만족도 순위 (Top ${topRating.length})

| 항목 | 전체 평균 점수 |
| --- | --- |
| 프로그램 만족도 | ${data.satisfaction.programAvg !== null ? `⭐ ${data.satisfaction.programAvg.toFixed(1)} / 5.0` : '평가 없음'} |
| 지도자 만족도 | ${data.satisfaction.leaderAvg !== null ? `⭐ ${data.satisfaction.leaderAvg.toFixed(1)} / 5.0` : '평가 없음'} |
| 시설 만족도 | ${data.satisfaction.facilityAvg !== null ? `⭐ ${data.satisfaction.facilityAvg.toFixed(1)} / 5.0` : '평가 없음'} |

${topRatingTable}

## 5. 참여자 연령 분포

| 연령대 | 인원 | 비율 |
| --- | --- | --- |
${ageDistRows(data.ageGroups)}

## 6. 종합 의견

- 전체 만족도: ${satisfactionComment(overallAvg).replace(/\*\*/g, '')}
- 향후 운영 시 상위 기관의 운영 사례를 공유하고, 만족도 저조 기관에 대한 컨설팅을 검토해주세요.
`
}
