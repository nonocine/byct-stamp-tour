/**
 * 비공개 버킷 파일 참조 — 클라이언트·서버 공용(서버 전용 import 금지).
 *
 * report-photos / program-plans 는 비공개 버킷으로 바꾼다(2026-10). 그래서
 *   · DB 에는 버킷 안 경로(path)만 저장한다. 예전에 저장된 공개 URL 문자열도 그대로 읽힌다
 *     (storageRefPath 가 URL 에서 경로를 뽑음 — DB 를 고쳐 쓰지 않아도 됨).
 *   · 화면·보고서 링크는 공개 URL 대신 /api/admin/storage-file 로 보낸다. 그 라우트가
 *     관리자 로그인과 기관 권한을 확인한 뒤 1시간짜리 서명 URL 로 넘겨 준다.
 *   · Word 보고서처럼 파일 내용을 넣는 곳은 raw=1 로 받아 서버가 직접 내려받은 바이트를 쓴다.
 */

export const PRIVATE_BUCKETS = ['report-photos', 'program-plans'] as const
export type PrivateBucket = (typeof PRIVATE_BUCKETS)[number]

export function isPrivateBucket(v: unknown): v is PrivateBucket {
  return (PRIVATE_BUCKETS as readonly unknown[]).includes(v)
}

/**
 * 저장된 값(경로 또는 예전 공개 URL) → 버킷 안 경로.
 * 상위 경로(..)·절대 경로·다른 버킷 URL 은 null.
 */
export function storageRefPath(ref: string, bucket: string): string | null {
  let path = ref.trim()
  if (!path) return null
  if (/^https?:\/\//i.test(path)) {
    const marker = `/${bucket}/`
    const idx = path.indexOf(marker)
    if (idx < 0) return null
    path = path.slice(idx + marker.length).split('?')[0]
    try {
      path = decodeURIComponent(path)
    } catch {
      return null
    }
  }
  if (!path || path.startsWith('/') || path.includes('..')) return null
  return path
}

/** 화면·링크에 쓰는 주소. raw=true 면 서버가 내려받은 파일 내용을 그대로 돌려준다(보고서 첨부용). */
export function storageViewUrl(bucket: PrivateBucket, ref: string, opts: { raw?: boolean } = {}): string {
  const q = new URLSearchParams({ bucket, ref })
  if (opts.raw) q.set('raw', '1')
  return `/api/admin/storage-file?${q.toString()}`
}
