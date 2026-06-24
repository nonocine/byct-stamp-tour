-- center_reports 테이블에 현장 사진 URL 배열 컬럼 추가

ALTER TABLE center_reports
ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
