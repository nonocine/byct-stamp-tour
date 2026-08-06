-- ============================================================================
-- 20260806_06_rls_programs_write_and_storage.sql
--   [2-B단계] programs 쓰기 차단 + Storage 버킷 3개 쓰기 차단
--
-- 선행 배포 완료 (운영 반영 확인 후 실행할 것):
--   programs 쓰기        /api/admin/programs (POST 생성 / PUT 수정)
--   계획서 PDF           /api/admin/programs/plan (POST 업로드 / DELETE 삭제)
--   프로그램 이미지      /api/admin/programs/image (POST)
--   전체 계획서 PDF      /api/admin/global-plans (POST 가 파일까지 받도록 변경,
--                        DELETE 가 Storage 파일도 정리)
--   현장 사진            /api/admin/report-photos (POST / DELETE)
--
-- ── 무엇을 막는가 ───────────────────────────────────────────────────────────
-- programs: 정책 4개가 모두 using(true) 였다 → anon key 를 가진 누구나 17개 기관의
--   프로그램을 만들고 고치고 지울 수 있었다. 읽기는 계속 공개다
--   (/programs 페이지가 비로그인 방문자에게 목록을 보여준다).
--
-- Storage: program-plans / program-images / report-photos 세 버킷이 anon 에게
--   INSERT/UPDATE/DELETE 를 전면 허용하고 있었다. 즉 누구나 운영계획서 PDF와
--   기관 현장 사진을 **덮어쓰거나 삭제**할 수 있었다. SELECT 만 남긴다
--   (세 버킷 모두 public 이므로 공개 읽기는 유지되어야 한다).
-- ============================================================================

begin;

-- ── programs: 공개 읽기만 남기고 쓰기 제거 ─────────────────────────────────
alter table public.programs enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'programs'
  loop
    execute format('drop policy %I on public.programs', p.policyname);
  end loop;
end $$;

revoke all on table public.programs from anon, authenticated;
grant select on table public.programs to anon, authenticated;

create policy "programs_public_read"
  on public.programs
  for select
  to anon, authenticated
  using (true);

-- ── Storage: 세 버킷의 쓰기 정책 제거, 읽기 정책만 유지 ────────────────────
-- 정책 이름이 버킷마다 제각각이라(과거에 대시보드에서 만든 것들) 이름을
-- 가정하지 않고 "해당 버킷을 대상으로 하는 SELECT 이외의 정책"을 찾아 지운다.
do $$
declare
  p record;
  target_buckets text[] := array['program-plans', 'program-images', 'report-photos'];
  b text;
begin
  foreach b in array target_buckets
  loop
    for p in
      select policyname, cmd
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and cmd <> 'SELECT'
        and (coalesce(qual, '') like '%' || b || '%'
             or coalesce(with_check, '') like '%' || b || '%')
    loop
      raise notice 'dropping storage policy % (%) for bucket %', p.policyname, p.cmd, b;
      execute format('drop policy %I on storage.objects', p.policyname);
    end loop;
  end loop;
end $$;

commit;

-- ── 검증 ────────────────────────────────────────────────────────────────────
-- programs:
-- select relrowsecurity,
--        (select count(*) from pg_policies where tablename='programs') as policies,
--        has_table_privilege('anon','public.programs','select') as sel,
--        has_table_privilege('anon','public.programs','insert') as ins
--   from pg_class where oid='public.programs'::regclass;
-- 기대: t / 1 / t / f
--
-- storage: 세 버킷에 SELECT 정책만 남아야 한다
-- select policyname, cmd, coalesce(qual, with_check) as target
--   from pg_policies where schemaname='storage' and tablename='objects'
--  order by policyname;

-- ── 롤백 ────────────────────────────────────────────────────────────────────
-- begin;
--   grant all on table public.programs to anon, authenticated;
--   drop policy if exists "programs_public_read" on public.programs;
--   create policy "programs_select" on public.programs for select using (true);
--   create policy "programs_insert" on public.programs for insert with check (true);
--   create policy "programs_update" on public.programs for update using (true);
--   create policy "programs_delete" on public.programs for delete using (true);
--
--   create policy "program_plans_insert" on storage.objects for insert
--     with check (bucket_id = 'program-plans');
--   create policy "program_plans_update" on storage.objects for update
--     using (bucket_id = 'program-plans') with check (bucket_id = 'program-plans');
--   create policy "program_plans_delete" on storage.objects for delete
--     using (bucket_id = 'program-plans');
--   create policy "storage_insert" on storage.objects for insert
--     with check (bucket_id = 'program-images');
--   create policy "storage_update" on storage.objects for update
--     using (bucket_id = 'program-images');
--   create policy "storage_delete" on storage.objects for delete
--     using (bucket_id = 'program-images');
--   create policy "report_photos_insert" on storage.objects for insert
--     with check (bucket_id = 'report-photos');
--   create policy "report_photos_update" on storage.objects for update
--     using (bucket_id = 'report-photos');
--   create policy "report_photos_delete" on storage.objects for delete
--     using (bucket_id = 'report-photos');
-- commit;

-- ── 참고: org-logos 버킷은 이 파일 범위 밖이다 ──────────────────────────────
-- org-logos 는 storage.objects 정책이 0개다. storage.objects 는 RLS가 켜져 있으므로
-- anon 의 업로드는 이미 거부된다 → ProgramTab 의 기관 로고 업로드는 지금도
-- 동작하지 않을 것으로 보인다(공개 읽기는 public 버킷이라 정상).
-- organization_logos 테이블 쓰기도 아직 열려 있다. 별도 확인·처리 필요.
