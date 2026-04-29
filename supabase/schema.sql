-- ============================================
-- B.Y.C.T 스탬프투어 Supabase 스키마
-- ============================================

-- 참가자 테이블
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  school      text not null,
  contact     text not null,
  type        text not null check (type in ('general', 'youth')),
  grade       text,
  created_at  timestamptz default now()
);

-- 스탬프 테이블
create table if not exists stamps (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid references participants(id) on delete cascade,
  program_id      text not null,
  organization_id integer not null,
  rating          integer not null check (rating >= 1 and rating <= 5),
  review          text,
  program_name    text not null,
  created_at      timestamptz default now(),
  -- 기관당 1개만 허용
  unique(participant_id, organization_id)
);

-- RLS 활성화
alter table participants enable row level security;
alter table stamps enable row level security;

-- 참가자: 누구나 삽입 가능, 자기 데이터만 조회
create policy "participants_insert" on participants for insert with check (true);
create policy "participants_select" on participants for select using (true);

-- 스탬프: 누구나 삽입, 조회 가능
create policy "stamps_insert" on stamps for insert with check (true);
create policy "stamps_select" on stamps for select using (true);

-- 통계 뷰 (관리자용)
create or replace view stamp_stats as
select
  o_id                                   as organization_id,
  count(*)                               as stamp_count,
  round(avg(rating)::numeric, 1)         as avg_rating
from stamps
group by o_id;

-- 기관별 통계 뷰
create or replace view org_stamp_summary as
select
  organization_id,
  count(*)                    as total_stamps,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(distinct participant_id) as unique_participants
from stamps
group by organization_id
order by total_stamps desc;

-- 참가자별 스탬프 수 뷰
create or replace view participant_progress as
select
  p.id,
  p.name,
  p.school,
  p.grade,
  p.type,
  p.contact,
  p.created_at,
  count(s.id) as stamp_count,
  round(avg(s.rating)::numeric, 1) as avg_rating
from participants p
left join stamps s on s.participant_id = p.id
group by p.id
order by stamp_count desc;

-- ============================================
-- 기관 평가 (별점 + 한줄평) 테이블
-- ============================================
create table if not exists reviews (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid not null,
  participant_name  text not null,
  center_id         integer not null,
  center_name       text not null,
  rating            integer not null check (rating >= 1 and rating <= 5),
  comment           text,
  created_at        timestamptz default now(),
  -- 참가자 1명당 기관 1개 평가 (수정은 upsert로 created_at 갱신)
  unique(participant_id, center_id)
);

create index if not exists reviews_center_id_idx on reviews(center_id);
create index if not exists reviews_participant_id_idx on reviews(participant_id);

alter table reviews enable row level security;

create policy "reviews_insert" on reviews for insert with check (true);
create policy "reviews_select" on reviews for select using (true);
create policy "reviews_update" on reviews for update using (true) with check (true);
create policy "reviews_delete" on reviews for delete using (true);

-- 기관별 평균 별점 / 평가 수 뷰
create or replace view center_review_summary as
select
  center_id,
  center_name,
  count(*)                              as review_count,
  round(avg(rating)::numeric, 1)        as avg_rating
from reviews
group by center_id, center_name
order by avg_rating desc nulls last;

-- ============================================
-- 프로그램 신청 (참가자가 외부 신청 후 "완료" 누른 기록)
-- ============================================
create table if not exists applications (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      uuid not null,
  participant_name    text not null,
  participant_phone   text not null,
  center_id           integer not null,
  center_name         text not null,
  status              text not null default 'pending' check (status in ('pending', 'approved')),
  applied_at          timestamptz default now(),
  unique(participant_id, center_id)
);

create index if not exists applications_center_id_idx on applications(center_id);
create index if not exists applications_status_idx on applications(status);
create index if not exists applications_participant_id_idx on applications(participant_id);

alter table applications enable row level security;

create policy "applications_insert" on applications for insert with check (true);
create policy "applications_select" on applications for select using (true);
create policy "applications_update" on applications for update using (true) with check (true);
create policy "applications_delete" on applications for delete using (true);
