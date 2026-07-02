-- 슈퍼관리자(role = 'super') 추가 시 center_id가 null이어도 저장되도록 허용
-- 슈퍼관리자는 특정 기관에 소속되지 않으므로 center_id / center_name 이 null 이어야 함
-- (코드에서는 이미 role === 'super' 일 때 null 을 전송하고 있으나, DB NOT NULL 제약으로 저장이 실패함)

alter table admins alter column center_id drop not null;
alter table admins alter column center_name drop not null;
