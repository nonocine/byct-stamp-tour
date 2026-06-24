import type { CenterReportData, GlobalReportData, AgeGroups } from './reportData'

function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}
function todayKorean(): string {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function participationComment(rate: number): string {
  if (rate >= 80) return '**매우 우수한 참여도**로, 신청자 대부분이 실제 스탬프 발급까지 이어졌습니다.'
  if (rate >= 60) return '**양호한 참여도**를 보이고 있습니다. 일부 신청자가 실제 참여로 이어지지 않은 점은 추후 개선 여지가 있습니다.'
  return '**참여 활성화가 필요**합니다. 신청 대비 실제 참여율이 낮으므로 알림/리마인드 등 후속 안내를 강화할 필요가 있습니다.'
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
    ? `| 프로그램명 | 일정 | 정원 | 대상 | 계획서 |
| --- | --- | --- | --- | --- |
${data.programs
  .map(
    p =>
      `| ${p.title} | ${p.date ?? '-'} ${p.time ?? ''} | ${fmtNum(p.capacity)}명 | ${p.target || '-'} | ${p.hasPlanPdf ? '✅' : '-'} |`,
  )
  .join('\n')}`
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
    ? `| 일자 | 신청 | 스탬프 |
| --- | --- | --- |
${data.timeline.map(t => `| ${t.date} | ${fmtNum(t.applications)} | ${fmtNum(t.stamps)} |`).join('\n')}`
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

## 3. 신청 현황

| 상태 | 건수 |
| --- | --- |
| 전체 신청 | ${fmtNum(data.applications.total)} |
| 승인 완료 | ${fmtNum(data.applications.approved)} |
| 대기열 | ${fmtNum(data.applications.waiting)} |
| 승인 대기 | ${fmtNum(data.applications.pending)} |
| 거절 | ${fmtNum(data.applications.rejected)} |

## 4. 참여 현황

- 발급된 스탬프 수: **${fmtNum(data.stamps.total)}건**
- 실제 참여 인원(중복 제거): **${fmtNum(data.stamps.uniqueParticipants)}명**
- **참여율: ${fmtPct(data.participation.rate)}** (승인 신청 대비 스탬프 발급률)

> ${participationComment(data.participation.rate)}

## 5. 참여자 연령 분포

| 연령대 | 인원 | 비율 |
| --- | --- | --- |
${ageDistRows(data.ageGroups)}

## 6. 만족도

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

## 7. 일자별 추이 (최근 ${data.timeline.length}일)

${timelineBlock}

## 8. 종합 의견

- 참여율 ${fmtPct(data.participation.rate)}: ${participationComment(data.participation.rate).replace(/\*\*/g, '')}
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

  const centerSummaryTable = `| 기관 | 프로그램 | 승인 | 스탬프 | 별점 |
| --- | --- | --- | --- | --- |
${data.centerSummary
  .map(
    r =>
      `| ${r.name} | ${fmtNum(r.programs)} | ${fmtNum(r.approved)} | ${fmtNum(r.stamps)} | ${r.avgRating !== null ? `⭐${r.avgRating.toFixed(1)}` : '-'} |`,
  )
  .join('\n')}`

  const planBlock = data.latestGlobalPlan
    ? `> **최신 전체 계획서**: ${data.latestGlobalPlan.title} _(업로드: ${data.latestGlobalPlan.uploadedBy})_
>
> [PDF 보기 →](${data.latestGlobalPlan.pdfUrl})`
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
| 전체 신청 | ${fmtNum(t.applications)}건 |
| 승인 완료 | ${fmtNum(t.approved)}건 |
| 대기열 | ${fmtNum(t.waiting)}건 |
| 거절 | ${fmtNum(t.rejected)}건 |
| 발급 스탬프 | ${fmtNum(t.stamps)}건 |
| 실 참여 인원(중복 제거) | ${fmtNum(t.uniqueParticipants)}명 |
| 전체 참여율 | ${fmtPct(data.participation.rate)} |
| 전체 평균 별점 | ${overallAvg !== null ? `⭐ ${overallAvg.toFixed(1)} / 5.0` : '평가 없음'} |

> ${participationComment(data.participation.rate)}
>
> ${satisfactionComment(overallAvg)}

## 2. 기관별 종합 통계

${centerSummaryTable}

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

- 전체 참여율 ${fmtPct(data.participation.rate)}: ${participationComment(data.participation.rate).replace(/\*\*/g, '')}
- 전체 만족도: ${satisfactionComment(overallAvg).replace(/\*\*/g, '')}
- 향후 운영 시 상위 기관의 운영 사례를 공유하고, 만족도 저조 기관에 대한 컨설팅을 검토해주세요.
`
}
