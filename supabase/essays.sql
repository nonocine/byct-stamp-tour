-- ============================================================================
-- essays.sql  —  참가자 소감문 (1인 1편) + 우수작 선정
--   Supabase 프로젝트: ppgthptyjjrcmkeearfx  (SQL Editor 에서 한 번 실행)
--   멱등: 여러 번 실행해도 결과가 같다.
--
-- 본문 구성 — 동래 독립탐험대(dream-road) 소감문의 "사진 + 글" 구조를 따르되,
--   초중학생이 빈칸 앞에서 막히지 않도록 질문 4개로 나눴다.
--     q_activity  어떤 활동을 했나요?            (필수)
--     q_memory    가장 기억에 남는 순간은?       (필수)
--     q_feeling   어떤 생각·느낌이 들었나요?     (필수)
--     q_message   다음에 해 보고 싶은 것 / 하고 싶은 말 (선택)
--
-- RLS — 기존 BYCT 참가자 데이터(profiles / stamp_records / reviews …)와 같은 방식:
--   RLS 켬 + 정책 0개 + anon·authenticated 권한 회수 = 브라우저 직접 접근 전면 거부.
--   이름·전화번호(대부분 미성년자)가 들어가므로 using(true) 로 열지 않는다.
--   읽기·쓰기는 세션 쿠키를 검증하는 API 라우트(service_role)만 한다.
--     참가자  /api/me/essay
--     관리자  /api/admin/essays , /api/admin/essays/special , /api/admin/sms
--
-- ⚠️ Storage 버킷 essay-photos 는 이 파일에 없다. 대시보드에서 직접 만든다
--   (Storage → New bucket → 이름 essay-photos, Public 켬). 업로드는 서버가
--   service_role 로 하므로 Storage 정책은 따로 만들 필요가 없다.
-- ============================================================================

begin;

create table if not exists public.essays (
  id                 uuid primary key default gen_random_uuid(),
  participant_id     uuid not null unique references public.profiles(id) on delete cascade,
  participant_name   text not null,
  participant_phone  text not null check (participant_phone ~ '^[0-9]+$'),  -- 하이픈 없이
  center_id          integer not null,   -- 아이가 고른 기관 = 우수작 선정 기관
  center_name        text not null,

  q_activity         text not null default '',
  q_memory           text not null default '',
  q_feeling          text not null default '',
  q_message          text not null default '',

  photo_url          text,                -- essay-photos 공개 URL

  is_excellent       boolean not null default false,
  excellent_by       text,                -- 선정한 관리자 이름 (stamp_records.approved_by 와 같은 방식)
  excellent_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists essays_center_id_idx on public.essays (center_id);
create index if not exists essays_excellent_idx on public.essays (is_excellent) where is_excellent;

-- updated_at 자동 갱신
create or replace function public.essays_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists essays_touch_updated_at on public.essays;
create trigger essays_touch_updated_at
  before update on public.essays
  for each row execute function public.essays_touch_updated_at();

-- RLS: 켬 + 정책 0개 + 권한 회수 (20260806_05_rls_stage2a.sql 과 동일 패턴)
alter table public.essays enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'essays'
  loop
    execute format('drop policy %I on public.essays', p.policyname);
  end loop;
end $$;

revoke all on table public.essays from anon, authenticated;

commit;

-- ── 검증 ────────────────────────────────────────────────────────────────────
-- select relrowsecurity as rls,
--        (select count(*) from pg_policies where tablename = 'essays') as policies,
--        has_table_privilege('anon', 'public.essays', 'select') as anon_select
--   from pg_class where oid = 'public.essays'::regclass;
-- 기대: rls = t / policies = 0 / anon_select = f

-- ── 롤백 (데이터 삭제됨) ────────────────────────────────────────────────────
-- drop table if exists public.essays;
-- drop function if exists public.essays_touch_updated_at();
