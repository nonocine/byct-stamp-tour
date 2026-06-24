-- 보고서 현장 사진 저장용 Storage 버킷 생성

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "anon all" ON storage.objects
FOR ALL TO anon
USING (bucket_id = 'report-photos')
WITH CHECK (bucket_id = 'report-photos');
