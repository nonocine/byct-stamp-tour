import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envText = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envText.split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  }),
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const rows = [
  { id: 'prog-1-1',  organization_id: 1,  title: '제과제빵 빵실빵실',          description: '직접 반죽하고 구워보는 달콤한 제과제빵 체험 프로그램',                              date: '2026-06-13', time: '15:00 ~ 17:00',     capacity: 20, location: '해운대청소년수련관',     target: '중학생' },
  { id: 'prog-2-1',  organization_id: 2,  title: 'VR·AR이 머지?',            description: '최신 VR·AR 기기를 직접 체험하며 가상현실과 증강현실의 원리를 배우는 프로그램',          date: '2026-06-20', time: '10:00 ~ 12:00',     capacity: 40, location: '양정청소년수련관',       target: '청소년' },
  { id: 'prog-2-2',  organization_id: 2,  title: '플라워 메이커',              description: '꽃을 활용한 플로럴 공예 체험으로 감성과 창의력을 키우는 프로그램',                    date: '2026-06-27', time: '10:00 ~ 12:00',     capacity: 40, location: '양정청소년수련관',       target: '청소년' },
  { id: 'prog-3-1',  organization_id: 3,  title: '제과제빵 체험',              description: '맛있는 빵과 과자를 직접 만들어보는 달콤한 제과제빵 체험',                            date: '2026-07-04', time: '10:00 ~ 12:00',     capacity: 40, location: '해운대청소년문화의집',   target: '초등 3~6학년' },
  { id: 'prog-4-1',  organization_id: 4,  title: '스마트팜 체험',              description: 'ICT 기술을 활용한 첨단 스마트팜을 직접 체험하고 미래 농업을 배우는 프로그램',          date: '2026-07-11', time: '10:00 ~ 12:00',     capacity: 40, location: '금곡청소년수련관',       target: '9~24세' },
  { id: 'prog-6-1',  organization_id: 6,  title: '수다방탈출 힐링프로젝트',     description: '친구들과 함께 방탈출 미션을 해결하며 소통과 힐링을 동시에 경험하는 프로그램',          date: '2026-07-29', time: '13:00 ~ 15:00',     capacity: 20, location: '수영구청소년문화의집',   target: '초등 4~6학년' },
  { id: 'prog-7-1',  organization_id: 7,  title: '우주여행! 천체관측',         description: '금련산 자연 속에서 별자리와 행성을 관측하는 1박 2일 천체관측 캠프',                  date: '2026-08-08', time: '1박 2일 (토~일)',   capacity: 40, location: '금련산청소년수련원',     target: '청소년' },
  { id: 'prog-8-1',  organization_id: 8,  title: '스포츠클라이밍 오르樂',       description: '실내 클라이밍 벽을 오르며 도전과 극복의 즐거움을 배우는 스포츠 체험',                date: '2026-08-08', time: '10:00 ~ 12:00',     capacity: 40, location: '사하구청소년문화의집',   target: '청소년' },
  { id: 'prog-8-2',  organization_id: 8,  title: '디지털드로잉 똑띠공작소',     description: '태블릿과 디지털 툴을 활용해 나만의 작품을 만드는 디지털 드로잉 체험',                date: '2026-09-19', time: '10:00 ~ 12:00',     capacity: 40, location: '사하구청소년문화의집',   target: '청소년' },
  { id: 'prog-8-3',  organization_id: 8,  title: '디지털드로잉 똑띠공작소',     description: '태블릿과 디지털 툴을 활용해 나만의 작품을 만드는 디지털 드로잉 체험',                date: '2026-10-31', time: '10:00 ~ 12:00',     capacity: 40, location: '사하구청소년문화의집',   target: '청소년' },
  { id: 'prog-9-1',  organization_id: 9,  title: '3D프린터 체험',             description: '3D 모델링부터 프린팅까지 직접 체험하며 미래 제조 기술을 배우는 프로그램',            date: '2026-08-04', time: '10:00 ~ 12:00',     capacity: 40, location: '부전청소년센터',         target: '청소년' },
  { id: 'prog-9-2',  organization_id: 9,  title: '바리스타 체험',              description: '커피의 역사와 제조 과정을 배우고 직접 음료를 만들어보는 바리스타 직업 체험',          date: '2026-08-06', time: '10:00 ~ 12:00',     capacity: 40, location: '부전청소년센터',         target: '청소년' },
  { id: 'prog-10-1', organization_id: 10, title: '미션! 문화의집 대탐험',       description: '문화의집 곳곳을 탐험하며 미션을 수행하는 신나는 탐험 체험 프로그램',                date: '2026-08-22', time: '10:00 ~ 12:00',     capacity: 30, location: '북구청소년문화의집',     target: '청소년' },
  { id: 'prog-11-1', organization_id: 11, title: '업사이클링 키링만들기',       description: '버려지는 소재를 활용해 나만의 키링을 만드는 환경 친화적 공예 체험',                date: '2026-08-29', time: '10:00 ~ 12:00',     capacity: 20, location: '사상구청소년센터',       target: '청소년' },
  { id: 'prog-12-1', organization_id: 12, title: '도전! 스포츠클라이밍',        description: '실내 클라이밍 벽을 오르며 자신의 한계를 극복하는 스포츠 클라이밍 체험',              date: '2026-09-05', time: '10:00 ~ 12:00',     capacity: 40, location: '전포청소년센터',         target: '청소년' },
  { id: 'prog-13-1', organization_id: 13, title: '세계요리 만들기 (1회)',      description: '세계 각국의 다양한 요리를 직접 만들어보며 글로벌 식문화를 체험하는 프로그램 (1회차)', date: '2026-08-29', time: '10:00 ~ 12:00',     capacity: 40, location: '가야청소년센터',         target: '청소년' },
  { id: 'prog-13-2', organization_id: 13, title: '세계요리 만들기 (2회)',      description: '세계 각국의 다양한 요리를 직접 만들어보며 글로벌 식문화를 체험하는 프로그램 (2회차)', date: '2026-09-05', time: '10:00 ~ 12:00',     capacity: 40, location: '가야청소년센터',         target: '청소년' },
  { id: 'prog-13-3', organization_id: 13, title: '세계요리 만들기 (3회)',      description: '세계 각국의 다양한 요리를 직접 만들어보며 글로벌 식문화를 체험하는 프로그램 (3회차)', date: '2026-09-12', time: '10:00 ~ 12:00',     capacity: 40, location: '가야청소년센터',         target: '청소년' },
  { id: 'prog-13-4', organization_id: 13, title: '세계요리 만들기 (4회)',      description: '세계 각국의 다양한 요리를 직접 만들어보며 글로벌 식문화를 체험하는 프로그램 (4회차)', date: '2026-09-19', time: '10:00 ~ 12:00',     capacity: 40, location: '가야청소년센터',         target: '청소년' },
  { id: 'prog-14-1', organization_id: 14, title: '일본요리 만들기',            description: '일본의 대표 요리를 직접 만들어보며 일본 식문화를 체험하는 요리 프로그램',           date: '2026-10-10', time: '10:00 ~ 12:00',     capacity: 40, location: '서구청소년문화의집',     target: '청소년' },
  { id: 'prog-15-1', organization_id: 15, title: '도시농부 유스팜 스마트팜',    description: '도심 속 스마트팜에서 씨앗부터 수확까지 직접 경험하는 도시농업 체험',                date: '2026-10-17', time: '10:00 ~ 12:00',     capacity: 20, location: '그랜드모먼트유스호스텔', target: '청소년' },
  { id: 'prog-16-1', organization_id: 16, title: '양궁·펜싱 레저스포츠',        description: '양궁과 펜싱을 직접 체험하며 집중력과 체력을 동시에 키우는 레저스포츠 프로그램',      date: '2026-10-24', time: '10:00 ~ 12:00',     capacity: 40, location: '아르피나',               target: '청소년' },
  { id: 'prog-17-1', organization_id: 17, title: '뮤직비디오 제작 뮤직ON-AIR', description: '기획·촬영·편집까지 나만의 뮤직비디오를 직접 제작하는 미디어 창작 체험',              date: '2026-10-31', time: '10:00 ~ 13:00',     capacity: 20, location: '금정청소년수련관',       target: '청소년' },
]

console.log(`Inserting ${rows.length} programs...`)

const { data, error } = await supabase
  .from('programs')
  .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  .select('id, organization_id, title')

if (error) {
  console.error('FAIL:', error)
  process.exit(1)
}

console.log(`OK: ${data?.length ?? 0} rows upserted`)

const { count } = await supabase.from('programs').select('id', { count: 'exact', head: true })
console.log(`Total programs in DB: ${count}`)

const { data: byOrg } = await supabase
  .from('programs')
  .select('organization_id')
  .order('organization_id')
const counts = {}
;(byOrg ?? []).forEach(r => { counts[r.organization_id] = (counts[r.organization_id] ?? 0) + 1 })
console.log('Per-org counts:', counts)
