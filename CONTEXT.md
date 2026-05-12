# B.Y.C.T 스탬프투어 — 프로젝트 컨텍스트

> 이 문서는 새로운 작업자(또는 차후 세션의 AI)가 빠르게 프로젝트 맥락을 파악할 수 있도록 정리한 핸드오프 노트입니다.

---

## 1. 프로젝트 개요

- **이름**: B.Y.C.T 스탬프투어 (Busan Youth Center Tour)
- **주최**: 부산광역시청소년수련시설협회
- **목적**: 부산 17개 청소년수련시설을 청소년/일반 참가자가 직접 방문·체험하고, 각 기관에서 스탬프를 모아 완주 인증서를 받는 모바일 친화 웹앱
- **운영기간**: 2026년 6월 ~ 11월
- **타깃 디바이스**: 모바일 우선 (참가자) + PC (기관 관리자)
- **수료 기준**: 스탬프 3개 이상 → 수료증 / 17개 전부 → 완주 인증 + 포상

---

## 2. 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + React 18 |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS 3.4 |
| 백엔드 / DB | Supabase (PostgreSQL + RLS) |
| 인증 | 자체 구현 (전화번호 + 생년월일, localStorage 세션) |
| 지도 | Kakao Maps JavaScript SDK + services 라이브러리 (geocoding) |
| 아이콘 | lucide-react |
| 인증서 PDF | html2canvas + jspdf |
| 데이터 익스포트 | xlsx |
| 배포 | Vercel |
| 패키지 매니저 | npm |

---

## 3. Supabase 정보 (공용 Supabase 사용)

> ⚠️ 협회 내부에서 공동으로 쓰는 **공용 Supabase 프로젝트**입니다. 새 프로젝트를 만들지 말고 아래 값을 그대로 사용하세요.

- **Project URL**: `https://ppgthptyjjrcmkeearfx.supabase.co`
- **Publishable (anon) Key**: `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 참조 (브라우저 노출용 키이며 RLS 정책으로 보호됨)
- **스키마 정의**: `supabase/schema.sql`

### 주요 테이블

| 테이블 | 용도 |
|---|---|
| `profiles` | 참가자 계정 (name, phone, birthdate) |
| `stamp_records` | 기관 관리자가 승인한 스탬프 기록 (단일 진실 소스) |
| `reviews` | 참가자가 기관에 남긴 별점/한줄평 |
| `applications` | 외부 신청 후 완료 처리한 프로그램 신청 기록 |
| `programs` | 기관별 운영 프로그램 (관리자가 CRUD) |
| `admins` | 기관 관리자 계정 (super / center 역할) |

### 주요 뷰

- `stamp_stats`, `org_stamp_summary`, `participant_progress`, `center_review_summary`

### RLS 정책

- 모든 테이블 RLS 활성화
- 현재는 누구나 insert/select 가능 (운영 단계에서 조이는 정책 보강 필요)

---

## 4. 배포 정보

- **운영 URL**: https://byct-stamp-tour.vercel.app
- **호스팅**: Vercel
- **기본 브랜치**: `master` (Vercel의 Production 브랜치)
- **자동 배포**: `master` 푸시 시 자동 production deploy
- **환경 변수**: Vercel 대시보드 → Project Settings → Environment Variables에 동일한 Supabase 키 등록 필요

> 향후 `vercel.ts` 도입 검토 가능 (현재는 vercel.json/vercel.ts 모두 없음)

---

## 5. 카카오맵 키 정보

- **JavaScript 앱 키**: `b15da2a5d31a20e1b272e534b9a24594`
- **위치**: `components/KakaoMap.tsx` 상단 `KAKAO_APP_KEY` 상수에 하드코딩
- **로드 라이브러리**: `services` (주소 → 좌표 변환 geocoder 사용)
- **등록된 플랫폼 도메인** (카카오 개발자 콘솔에 반드시 등록되어 있어야 함):
  - `http://localhost:3000` (로컬 개발)
  - `https://byct-stamp-tour.vercel.app` (운영)
  - Vercel preview 도메인을 쓰려면 별도 등록 필요

> 새 도메인에서 지도가 안 뜨면 99%는 카카오 콘솔의 플랫폼 등록 누락 문제입니다.

---

## 6. 지금까지 완성된 기능

### 참가자 (일반 사용자)
- ✅ 회원가입 / 로그인 (이름 + 전화번호 + 생년월일, localStorage 세션)
- ✅ 메인 페이지 — 히어로 배너, 내 스탬프 현황, 진행률, 기관 미리보기
- ✅ 프로그램 페이지 — 카카오맵 기반 17개 기관 위치 표시, 기관별 프로그램 리스트
- ✅ 스탬프 페이지 — 수집한 스탬프 그리드 표시
- ✅ 별점/한줄평 작성 (기관별 1회, upsert)
- ✅ 수료증 PDF 다운로드 (3개 이상 시 발급, html2canvas + jspdf)
- ✅ 외부 프로그램 신청 후 "신청 완료" 기록 (applications 테이블)
- ✅ 앱 최초 진입 시 스플래시 화면 (400px 로고)

### 기관 관리자
- ✅ 관리자 로그인 (전화번호 기반)
- ✅ 슈퍼관리자 / 센터관리자 역할 분리
- ✅ 대시보드 — 참가자/스탬프/완주자 통계, 기관별 분포
- ✅ 참가자 검색 → 스탬프 승인 (1기관 1스탬프)
- ✅ 참가자 목록/검색 (페이지네이션)
- ✅ 별점/한줄평 모니터링
- ✅ 외부 신청 승인 처리 (applications)
- ✅ 프로그램 CRUD (관리자가 자기 기관 프로그램 수정)
- ✅ 관리자 계정 관리 (슈퍼만)
- ✅ 외부 링크 관리
- ✅ 엑셀 다운로드 (xlsx)

### 데이터
- ✅ 17개 기관 데이터 (`lib/data.ts`)
- ✅ 23개 기관 프로그램 SEED (`scripts/seed-programs.mjs`, `insert_programs.sql`)

---

## 7. 미구현 기능 목록

| 우선순위 | 기능 | 메모 |
|---|---|---|
| 🔴 높음 | **전화번호 SMS 인증 로그인** | 현재는 전화번호+생년월일 단순 매칭. 본인확인이 불가. Supabase Phone Auth 또는 Twilio/NHN Cloud SENS 검토 |
| 🔴 높음 | **Supabase 영구 저장 (세션)** | 현재 로그인 세션이 localStorage에만 존재 → 기기 바꾸면 데이터 안 보임. Supabase Auth 도입 시 자동 해결 |
| 🟡 중간 | **관리자 승인 스탬프 시스템 고도화** | 현재도 관리자가 승인하지만, QR 코드 / 일회용 토큰 기반 등으로 부정 발급 방지 강화 필요 |
| 🟡 중간 | **참여자 통계 대시보드** | 학교/연령대/지역별 통계, 시계열 추이 차트, 인기 기관 랭킹 등 |
| 🟢 낮음 | **시설별 상세 페이지** | 현재 프로그램 페이지 안에 인라인 카드만 존재. 기관 단독 상세 페이지(소개, 사진, 약도, 전화, 운영시간) 필요 |

---

## 8. 17개 청소년시설 목록

| ID | 기관명 | 약칭 | 위치 | 카테고리 |
|---|---|---|---|---|
| 1 | 해운대청소년수련관 | 해수련 | 해운대구 | 요리·제빵 |
| 2 | 양정청소년수련관 | 양정관 | 부산진구 양정동 | 디지털·공예 |
| 3 | 해운대청소년문화의집 | 해문의 | 해운대구 | 요리·제빵 |
| 4 | 금곡청소년수련관 | 금곡관 | 북구 금곡동 | 스마트팜 |
| 5 | 동래구청소년센터 | 동래센 | 동래구 | 스포츠·AR |
| 6 | 수영구청소년문화의집 | 수영문 | 수영구 | 힐링·문화 |
| 7 | 금련산청소년수련원 | 금련산 | 수영구 금련산 | 과학·천체 |
| 8 | 사하구청소년문화의집 | 사하문 | 사하구 | 스포츠·디지털 |
| 9 | 부전청소년센터 | 부전센 | 부산진구 부전동 | 디지털·직업체험 |
| 10 | 북구청소년문화의집 | 북구문 | 북구 | 탐험·문화 |
| 11 | 사상구청소년센터 | 사상센 | 사상구 | 환경·공예 |
| 12 | 전포청소년센터 | 전포센 | 부산진구 전포동 | 스포츠 |
| 13 | 가야청소년센터 | 가야센 | 부산진구 가야동 | 요리·문화 |
| 14 | 서구청소년문화의집 | 서구문 | 서구 | 요리·문화 |
| 15 | 그랜드모먼트유스호스텔 | 그랜드 | 해운대구 | 스마트팜 |
| 16 | 아르피나 | 아르피 | 기장군 | 레저스포츠 |
| 17 | 금정청소년수련관 | 금정관 | 금정구 | 미디어·음악 |

> 원천 데이터는 `lib/data.ts`의 `ORGANIZATIONS` 배열입니다. ID는 절대 재할당하지 마세요 (DB의 `center_id` 외래 참조).

---

## 9. 절대 바꾸면 안 되는 결정사항

> 이 항목들은 과거에 결정되었거나 데이터 정합성과 직결되는 사항입니다. **수정 전 반드시 협회 담당자 확인 필수.**

1. **17개 기관 `id` 값** — `lib/data.ts`의 1~17번 ID는 DB의 `center_id`로 사용됨. 순서/숫자 변경 시 기존 스탬프/리뷰 데이터가 다른 기관에 붙음.
2. **스탬프 1기관 1개 원칙** — `stamps` / `stamp_records` 테이블의 `unique(participant_id, organization_id)` 제약. 한 참가자가 같은 기관에서 스탬프를 두 번 받을 수 없음.
3. **공용 Supabase 프로젝트** (`ppgthptyjjrcmkeearfx`) — 협회가 공동 소유. 새 프로젝트로 마이그레이션하려면 협회 차원의 합의가 필요.
4. **운영 도메인 `byct-stamp-tour.vercel.app`** — 카카오맵 플랫폼 도메인 등록과 묶여 있음. 도메인 변경 시 카카오 콘솔 재설정 필요.
5. **`stamp_records` 테이블이 스탬프의 단일 진실 소스** — 과거 `byct_stamps` localStorage 키, `stamps` 테이블 등이 있었으나 모두 폐기. `stamp_records`만 사용.
6. **`reactStrictMode: false`** (`next.config.js`) — 카카오맵 SDK가 더블 마운트에서 충돌하는 문제 회피용. 의도된 설정이므로 켜지 마세요.
7. **프로그램 컬럼명은 `title`** (`name` 아님) — DB 스키마와 통일됨 (커밋 2e9f307 참고).
8. **운영기간 표기 "6월~11월"** — 협회 공식 일정. 임의로 바꾸지 마세요.

---

## 10. 로컬 개발 방법

### 사전 준비
- Node.js 20+ (Node 24 LTS 권장)
- npm
- Git
- Supabase 키 (협회 담당자에게 요청, 또는 운영자가 가지고 있는 `.env.local` 복사)

### 셋업

```bash
# 1) 클론
git clone <repo-url> byct-stamp-tour
cd byct-stamp-tour

# 2) 의존성 설치
npm install

# 3) 환경 변수 설정
copy .env.local.example .env.local   # Windows
# cp .env.local.example .env.local   # macOS/Linux
# → .env.local 열어서 실제 Supabase URL/Key 입력

# 4) 개발 서버 실행
npm run dev
# → http://localhost:3000
```

### 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://ppgthptyjjrcmkeearfx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<협회 담당자에게 받은 값>
NEXT_PUBLIC_ADMIN_PASSWORD=byct2026
```

### 주요 npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 로컬 개발 서버 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 산출물로 서버 실행 |

### Supabase 스키마 초기화 (새 프로젝트일 때만)

```bash
# Supabase 대시보드 → SQL Editor 에서
# supabase/schema.sql 내용 붙여넣고 실행
```

### 프로그램 SEED

```bash
node scripts/seed-programs.mjs
# 또는 SQL Editor에서 insert_programs.sql 실행
```

### 카카오맵이 안 뜨면

1. 카카오 개발자 콘솔 → 내 애플리케이션 → 플랫폼 → Web
2. `http://localhost:3000` 가 등록되어 있는지 확인
3. 없으면 추가 후 새로고침

---

## 부록 — 디렉터리 구조 요약

```
byct-stamp-tour/
├─ app/                  # Next.js App Router 페이지
│  ├─ page.tsx           # 메인
│  ├─ login/             # 참가자 로그인/회원가입
│  ├─ programs/          # 기관 지도 + 프로그램 리스트
│  ├─ stamps/            # 내 스탬프 + 수료증
│  └─ admin/             # 관리자 대시보드
├─ components/           # 공통 컴포넌트
│  ├─ AuthProvider.tsx   # 참가자 인증 컨텍스트
│  ├─ AdminProvider.tsx  # 관리자 인증 컨텍스트
│  ├─ KakaoMap.tsx       # 카카오맵 래퍼
│  ├─ Certificate.tsx    # 수료증 템플릿
│  ├─ Splash.tsx         # 진입 스플래시
│  └─ ...
├─ lib/
│  ├─ data.ts            # 17개 기관 정적 데이터
│  ├─ programs.ts        # 프로그램 fetch 로직
│  ├─ supabase.ts        # Supabase 클라이언트
│  ├─ types.ts
│  └─ generateCertificate.ts
├─ public/
│  ├─ logos/             # 기관 로고
│  └─ association-logo.png
├─ scripts/
│  └─ seed-programs.mjs  # 프로그램 SEED
├─ supabase/
│  └─ schema.sql         # DB 스키마
└─ insert_programs.sql   # 프로그램 데이터
```
