-- ============================================
-- 프로그램별 외부 신청 링크 + 신청 프로그램 추적 컬럼 추가
-- ============================================

-- programs: 프로그램별 외부 신청 링크 (선택)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS application_url text;

-- applications: 어떤 프로그램으로 신청했는지 함께 저장
ALTER TABLE applications ADD COLUMN IF NOT EXISTS program_id text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS program_title text;
