-- reviews 테이블 만족도 항목 분리용 컬럼 추가
-- 기존 rating, comment 컬럼은 유지 (rating = 3개 항목 평균값)

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS program_rating integer,
ADD COLUMN IF NOT EXISTS leader_rating integer,
ADD COLUMN IF NOT EXISTS facility_rating integer,
ADD COLUMN IF NOT EXISTS wish_program text;
