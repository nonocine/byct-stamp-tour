-- ============================================================================
-- 20260806_05_rls_stage2a.sql  —  [2-A단계] 서버 이관이 끝난 5개 테이블 잠금
--
-- 02 / 03 파일을 통째로 실행하지 않고 이 파일을 쓰는 이유:
--   02 는 profiles / stamp_records / applications / centers 를 함께 잠그고,
--   03 은 programs / organization_logos 의 쓰기 경로까지 잠근다.
--   그 경로들은 아직 브라우저 코드에 남아 있어서 지금 잠그면 앱이 깨진다.
--   이 파일은 **이미 API 라우트로 이관이 끝난 테이블만** 잠근다.
--
-- 선행 배포 완료 (운영 반영 확인함):
--   reviews             /api/me/reviews (GET·POST·DELETE, 참가자 세션 쿠키)
--                       /api/admin/reviews (GET·DELETE, 관리자 세션)
--   push_subscriptions  /api/me/push-subscription (POST)
--                       /api/send-push (service_role + 관리자 세션 요구로 변경)
--   reports             /api/admin/reports (GET·POST·DELETE)
--   global_plans        /api/admin/global-plans (GET·POST·DELETE, 슈퍼 전용)
--   center_reports      /api/admin/center-report (GET·PUT)
--   집계                /api/admin/report-data (service_role 로 수집)
--   참가자 세션         /api/participant/{login,signup,logout}
--   연쇄 삭제           /api/admin/participants (DELETE, 슈퍼 전용)
--
-- 이 5개 테이블은 공개 읽기가 필요 없다 → 정책 0개 + 권한 회수로 전면 거부.
-- service_role 은 RLS를 우회하므로 위 라우트만 접근할 수 있다.
-- ============================================================================

begin;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'reviews',
    'push_subscriptions',
    'reports',
    'global_plans',
    'center_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- 기존 허용 정책 제거 (using(true) 로 열려 있던 것들)
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    -- 방어 2중화: 정책이 실수로 추가되어도 테이블 권한 자체가 없으면 접근 불가
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- ── 검증 ────────────────────────────────────────────────────────────────────
-- select c.relname, c.relrowsecurity as rls,
--        (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
--        has_table_privilege('anon', 'public.' || c.relname, 'select') as anon_select
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public'
--    and c.relname in ('reviews','push_subscriptions','reports','global_plans','center_reports');
-- 기대: rls = t / policies = 0 / anon_select = f  (5개 전부)

-- ── 롤백 ────────────────────────────────────────────────────────────────────
-- begin;
--   do $$ declare t text; begin
--     foreach t in array array['reviews','push_subscriptions','reports',
--                              'global_plans','center_reports']
--     loop
--       execute format('grant all on table public.%I to anon, authenticated', t);
--       execute format('alter table public.%I disable row level security', t);
--     end loop;
--   end $$;
-- commit;
-- ⚠️ 롤백만으로는 앱이 예전처럼 돌아가지 않는다. 코드가 이미 API 라우트를
--    쓰고 있으므로 서버 라우트는 계속 정상 동작한다 (service_role 은 영향 없음).
--    즉 이 롤백은 "노출을 되돌리는" 것이지 장애 복구 수단이 아니다.
