-- ============================================================================
-- 20260805_02_rls_participant_data.sql  —  [2단계] 참가자 데이터 차단
--
-- 대상: profiles, stamp_records, applications, reviews  → 전면 거부 (서버 전용)
--       centers                                        → 공개 읽기 + 쓰기 서버 전용
--
-- ⚠️ 적용 순서 경고
--   이 SQL은 **아래 코드가 전부 API 라우트로 이관되어 배포된 뒤에** 실행해야 한다.
--   먼저 실행하면 참가자 로그인·스탬프 조회·신청, 관리자 대시보드 전체가 즉시 죽는다.
--
--   이관 대상 (브라우저 → 서버):
--     profiles        app/login/page.tsx, app/admin/tabs/{DashboardTab,ParticipantTab,
--                     StampTab}.tsx, lib/{participants,exportParticipants,reportData}.ts
--     stamp_records   app/page.tsx, app/stamps/page.tsx, app/programs/page.tsx,
--                     app/admin/tabs/{StampTab,ApplicationTab,DashboardTab,
--                     ParticipantTab}.tsx, lib/{exportParticipants,reportData,
--                     participants}.ts
--     applications    app/programs/page.tsx, app/stamps/page.tsx, app/admin/page.tsx,
--                     app/admin/tabs/{ApplicationTab,StampTab,ParticipantTab}.tsx,
--                     lib/{exportParticipants,reportData,participants}.ts
--     reviews         app/stamps/page.tsx, components/ReviewModal.tsx,
--                     app/admin/tabs/{ReviewTab,StampTab}.tsx,
--                     lib/{reportData,participants}.ts
--     centers(쓰기)    app/admin/tabs/LinkTab.tsx
--
-- 왜 정책으로 "본인 데이터만" 을 표현하지 않는가
--   이 앱은 Supabase Auth 를 쓰지 않는다. 로그인은 전화번호+생년월일 매칭이고
--   세션은 localStorage 에만 있다. 따라서 DB 입장에서 auth.uid() 는 **항상 null** 이며
--   "본인 행만 허용" 같은 정책을 쓸 수단이 없다.
--   브라우저 직접 접근을 유지하면서 앱이 동작하는 유일한 정책은 using(true) 뿐이고,
--   그건 RLS를 켠 척만 하는 것이다(현재 programs/reports 등이 그 상태다).
--   → 실질 보안은 "서버 라우트 + service_role + 정책 0개" 조합에서만 나온다.
--     인가 판단은 HttpOnly 세션 쿠키를 검증하는 API 라우트가 담당한다.
-- ============================================================================

begin;

-- ── 참가자 개인정보 및 활동 기록: 전면 거부 ────────────────────────────────
-- profiles       : 참가자 162명의 이름/전화번호/생년월일 (대부분 미성년자).
--                  생년월일이 로그인 자격증명이므로 유출 = 계정 탈취.
-- stamp_records  : 스탬프 단일 진실 소스. 현재 누구나 발급/삭제 가능.
-- applications   : 신청 내역 및 승인 상태.
-- reviews        : 참가자가 남긴 별점/한줄평.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['profiles', 'stamp_records', 'applications', 'reviews']
  loop
    execute format('alter table public.%I enable row level security', t);

    -- 기존 허용 정책 전부 제거 (이름을 가정하지 않고 실제 존재하는 것을 지운다)
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ── centers: 공개 읽기 유지, 쓰기는 서버 전용 ──────────────────────────────
-- /programs 페이지가 비로그인 방문자에게도 기관별 신청 링크(program_url)를
-- 보여줘야 하므로 읽기는 anon 에 열어둔다. 민감 정보가 없는 테이블이다.
-- 쓰기(LinkTab 의 링크 저장)는 관리자 전용이므로 정책을 만들지 않는다.
alter table public.centers enable row level security;

drop policy if exists "centers_select" on public.centers;
drop policy if exists "centers_insert" on public.centers;
drop policy if exists "centers_update" on public.centers;
drop policy if exists "centers_delete" on public.centers;
drop policy if exists "anon all" on public.centers;

revoke all on table public.centers from anon, authenticated;
grant select on table public.centers to anon, authenticated;

create policy "centers_public_read"
  on public.centers
  for select
  to anon, authenticated
  using (true);

commit;

-- ── 검증 ────────────────────────────────────────────────────────────────────
-- select c.relname, c.relrowsecurity,
--        (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and c.relname in ('profiles','stamp_records','applications','reviews','centers');
-- 기대: 5개 모두 relrowsecurity = t / centers 만 policies = 1, 나머지 0

-- ── 롤백 ────────────────────────────────────────────────────────────────────
-- begin;
--   do $$ declare t text; begin
--     foreach t in array array['profiles','stamp_records','applications','reviews','centers']
--     loop
--       execute format('grant all on table public.%I to anon, authenticated', t);
--       execute format('alter table public.%I disable row level security', t);
--     end loop;
--   end $$;
-- commit;
