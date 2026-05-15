import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

function formatBirthdate(bd: string) {
  const d = (bd ?? '').replace(/\D/g, '')
  if (d.length !== 8) return bd ?? ''
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 참가자 현황 + 스탬프 상세를 두 개의 시트로 가진 .xlsx 다운로드.
 * centerId 가 지정되면 해당 기관에서 스탬프를 받은 참가자만 + 해당 기관 스탬프만 추출.
 */
export async function exportParticipantsExcel(centerId: number | null | undefined): Promise<void> {
  // 1. 기관 필터 시 해당 기관 참가자 ID 목록
  let filterIds: string[] | null = null
  if (centerId !== null && centerId !== undefined) {
    const { data: pidRows } = await supabase
      .from('stamp_records')
      .select('participant_id')
      .eq('center_id', centerId)
    filterIds = Array.from(
      new Set((pidRows ?? []).map((r: any) => r.participant_id).filter(Boolean))
    )
  }

  // 2. profiles 전체 fetch
  let pq = supabase
    .from('profiles')
    .select('id, name, phone, birthdate, created_at')
    .order('created_at', { ascending: false })
  if (filterIds !== null) {
    if (filterIds.length === 0) {
      alert('다운로드할 참가자가 없습니다')
      return
    }
    pq = pq.in('id', filterIds)
  }
  const { data: profiles } = await pq
  const profileList = profiles ?? []

  // 3. 스탬프 상세 fetch (centerId 있으면 해당 기관만)
  let sq = supabase
    .from('stamp_records')
    .select('participant_id, participant_name, participant_phone, center_id, center_name, approved_by, stamped_at')
    .order('stamped_at', { ascending: false })
  if (centerId !== null && centerId !== undefined) sq = sq.eq('center_id', centerId)
  const { data: stamps } = await sq
  const stampList = stamps ?? []

  // 4. 총 스탬프 수 계산용 (전체 17개 기관 기준 — distinct center_id)
  const ids = profileList.map(p => p.id)
  const { data: countData } = ids.length > 0
    ? await supabase
        .from('stamp_records')
        .select('participant_id, center_id')
        .in('participant_id', ids)
    : { data: [] }
  const orgsByPid: Record<string, Set<number>> = {}
  ;(countData ?? []).forEach((s: any) => {
    if (!s.participant_id) return
    if (!orgsByPid[s.participant_id]) orgsByPid[s.participant_id] = new Set()
    orgsByPid[s.participant_id].add(s.center_id)
  })

  // 5. Sheet1 — 참가자 목록
  const sheet1Rows = profileList.map((p, idx) => {
    const orgCount = orgsByPid[p.id]?.size ?? 0
    return {
      '번호': idx + 1,
      '이름': p.name,
      '전화번호': formatPhone(p.phone),
      '생년월일': formatBirthdate(p.birthdate),
      '가입일': formatDate(p.created_at),
      '총 스탬프 수': orgCount,
      '완주여부': orgCount >= 17 ? 'O' : '',
    }
  })

  // 6. Sheet2 — 스탬프 상세 기록
  const sheet2Rows = stampList.map((s: any, idx: number) => ({
    '번호': idx + 1,
    '참가자명': s.participant_name ?? '',
    '전화번호': formatPhone(s.participant_phone ?? ''),
    '기관명': s.center_name ?? '',
    '스탬프 날짜': s.stamped_at ? formatDate(s.stamped_at) : '',
    '승인한 관리자': s.approved_by ?? '',
  }))

  // 7. 워크북 생성
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(
    sheet1Rows.length > 0 ? sheet1Rows : [{ '안내': '데이터 없음' }]
  )
  const ws2 = XLSX.utils.json_to_sheet(
    sheet2Rows.length > 0 ? sheet2Rows : [{ '안내': '데이터 없음' }]
  )
  ws1['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  ws2['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, '참가자 목록')
  XLSX.utils.book_append_sheet(wb, ws2, '스탬프 상세')

  // 8. 파일명
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const orgSuffix = centerId !== null && centerId !== undefined
    ? `_${ORGANIZATIONS.find(o => o.id === centerId)?.name ?? ''}`
    : ''
  const fileName = `BYCT_참가자현황${orgSuffix}_${yyyy}${mm}${dd}.xlsx`

  XLSX.writeFile(wb, fileName)
}
