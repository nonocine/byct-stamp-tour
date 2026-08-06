-- ============================================================================
-- 20260805_01_rls_admins.sql  —  [1단계] admins 테이블 완전 차단
--
-- ⚠️ 적용 순서 경고
--   이 SQL을 실행하면 브라우저(anon key)에서 admins 테이블에 접근할 수 없다.
--   현재 app/admin/login/page.tsx 와 app/admin/tabs/AdminTab.tsx 는
--   브라우저에서 직접 admins 를 읽고 쓰므로, **아래 코드 변경이 먼저 배포된 뒤에**
--   이 SQL을 실행해야 한다.
--
--     선행 필수 배포:
--       - app/api/admin/login/route.ts      (service_role 로 비밀번호 검증)
--       - app/api/admin/admins/route.ts     (목록/추가/삭제)
--       - app/admin/login/page.tsx          → fetch('/api/admin/login')
--       - app/admin/tabs/AdminTab.tsx       → fetch('/api/admin/admins')
--       - Vercel 환경변수 SUPABASE_SERVICE_ROLE_KEY 등록
--
--   순서를 뒤집으면 관리자 로그인이 즉시 불가능해진다.
--
-- 왜 필요한가
--   admins 에는 관리자 21명의 비밀번호가 **평문**으로 저장되어 있고,
--   로그인 페이지가 select('*') 로 행 전체를 브라우저로 내려받는다.
--   anon key 는 JS 번들에 박히는 공개 값이므로, 현재는 누구나
--   전체 관리자 계정(전화번호 + 평문 비밀번호)을 덤프할 수 있다.
--
-- 이 파일이 만드는 상태
--   RLS 활성화 + 정책 0개 + anon/authenticated 권한 회수 → 전면 거부.
--   service_role 은 RLS를 우회하고 별도 권한을 가지므로 서버 라우트만 접근 가능.
-- ============================================================================

begin;

alter table public.admins enable row level security;

-- 정책을 만들지 않는다 = anon/authenticated 전면 거부.
-- 혹시 과거에 허용 정책이 남아 있다면 함께 제거.
drop policy if exists "admins_select" on public.admins;
drop policy if exists "admins_insert" on public.admins;
drop policy if exists "admins_update" on public.admins;
drop policy if exists "admins_delete" on public.admins;
drop policy if exists "anon all" on public.admins;

-- 방어 2중화: 정책이 실수로 추가되어도 테이블 권한 자체가 없으면 접근 불가.
revoke all on table public.admins from anon, authenticated;

commit;

-- ── 검증 ────────────────────────────────────────────────────────────────────
-- select relrowsecurity from pg_class where oid = 'public.admins'::regclass;   -- t
-- select count(*) from pg_policies where tablename = 'admins';                 -- 0
-- select has_table_privilege('anon', 'public.admins', 'select');               -- f

-- ── 롤백 ────────────────────────────────────────────────────────────────────
-- begin;
--   grant all on table public.admins to anon, authenticated;
--   alter table public.admins disable row level security;
-- commit;
