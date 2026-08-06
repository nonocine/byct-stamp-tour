-- ============================================================================
-- 20260805_03_rls_tighten_existing.sql  —  [3단계] 이미 RLS가 켜져 있으나
--                                          using(true) 로 사실상 열려 있는 테이블
--
-- 사용자가 지목한 12개 테이블 외에, 이 앱이 쓰는 다음 테이블들은
-- RLS가 "켜져" 있지만 anon 에게 SELECT/INSERT/UPDATE/DELETE 를 모두
-- using(true) 로 허용하고 있다. 즉 RLS를 끈 것과 보안 수준이 같다.
--
--   programs            4개 정책 모두 true  (공개 읽기는 필요, 쓰기는 관리자만이어야 함)
--   organization_logos  4개 정책 모두 true  (동일)
--   push_subscriptions  4개 정책 모두 true  (구독 정보 유출/스팸 발송 경로)
--   reports             4개 정책 모두 true  (기관 내부 보고서 본문)
--   global_plans        4개 정책 모두 true  (전체 사업계획서 PDF 링크)
--   center_reports      "anon all" 1개      (기관 의견 원문)
--
-- ⚠️ 적용 순서 경고: 2단계와 동일. 아래 코드가 서버로 이관된 뒤 실행해야 한다.
--     programs(쓰기)         app/admin/tabs/ProgramTab.tsx, lib/programs.ts
--     organization_logos(쓰기) app/admin/tabs/ProgramTab.tsx
--     push_subscriptions      components/PushNotificationButton.tsx,
--                             app/api/send-push/route.ts (service_role 로 교체)
--     reports                 app/admin/tabs/ReportTab.tsx, components/ReportManager.tsx
--     global_plans            app/admin/tabs/ReportTab.tsx
--     center_reports          components/CenterOpinionSection.tsx,
--                             components/ReportManager.tsx, lib/reportData.ts
-- ============================================================================

begin;

-- ── 공개 읽기가 필요한 테이블: 읽기만 남기고 쓰기 제거 ─────────────────────
-- programs           : /programs 페이지가 비로그인 방문자에게 프로그램 목록을 보여준다.
-- organization_logos : OrgLogosProvider 가 앱 전역에서 로고를 읽는다.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['programs', 'organization_logos']
  loop
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end $$;

-- ── 공개 읽기가 필요 없는 테이블: 전면 거부 (서버 전용) ────────────────────
-- push_subscriptions : endpoint/p256dh/auth 는 푸시 발송 자격이다. 유출 시 제3자가
--                      참가자 기기로 알림을 보낼 수 있다. 발송은 서버(service_role)만.
-- reports            : 기관 보고서 본문. 관리자 전용.
-- global_plans       : 전체 사업계획서. 슈퍼관리자 전용.
-- center_reports     : 기관 의견 원문. 관리자 전용.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['push_subscriptions', 'reports', 'global_plans', 'center_reports']
  loop
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- ============================================================================
-- 참고 — Storage 버킷도 같은 문제가 있다 (이 파일에서는 건드리지 않는다)
--
--   program-plans / program-images / report-photos : anon 에게 INSERT/UPDATE/DELETE
--     전면 허용 → 누구나 계획서 PDF를 업로드하거나 **기존 파일을 삭제**할 수 있다.
--   org-logos : 정책이 0개인 public 버킷 → 공개 읽기는 되지만 브라우저 업로드는
--     이미 실패할 것으로 보인다 (ProgramTab 의 로고 업로드 경로 점검 필요).
--
--   업로드/삭제를 API 라우트로 옮긴 뒤 anon 의 INSERT/UPDATE/DELETE 정책을 제거하고
--   SELECT 만 남기는 것이 정석이다. 코드 이관과 함께 별도 마이그레이션으로 진행 권장.
-- ============================================================================
