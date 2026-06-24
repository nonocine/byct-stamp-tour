-- 담당지도자 종합의견 저장 테이블

CREATE TABLE IF NOT EXISTS center_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id integer UNIQUE,
  opinion text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE center_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all" ON center_reports FOR ALL TO anon USING (true) WITH CHECK (true);
