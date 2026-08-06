/**
 * Storage 업로드 공통 헬퍼 (서버 전용).
 *
 * program-plans / program-images / report-photos 버킷은 anon 의 INSERT/UPDATE/DELETE
 * 정책을 제거했으므로 브라우저에서 직접 올릴 수 없다. 업로드는 관리자 세션을
 * 검증하는 API 라우트가 service_role 로 수행한다.
 */

export interface ParsedUpload {
  buffer: Buffer
  contentType: string
  filename: string
}

export interface UploadLimits {
  maxBytes: number
  /** 허용 MIME 프리픽스 또는 정확한 타입. 예: ['image/'] 또는 ['application/pdf'] */
  allowed: string[]
  /** 확장자 기반 보조 검사 (브라우저가 MIME 을 비워 보내는 경우) */
  allowedExtensions?: string[]
}

export class UploadError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function extensionOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * multipart/form-data 요청에서 file 필드를 읽고 크기·타입을 검증한다.
 * 검증 실패 시 UploadError 를 던진다.
 */
export async function readUpload(
  form: FormData,
  field: string,
  limits: UploadLimits,
): Promise<ParsedUpload> {
  const value = form.get(field)
  if (!value || typeof value === 'string') {
    throw new UploadError('업로드할 파일이 없습니다.')
  }

  const file = value as File
  if (file.size === 0) throw new UploadError('빈 파일입니다.')
  if (file.size > limits.maxBytes) {
    const mb = (limits.maxBytes / 1024 / 1024).toFixed(0)
    throw new UploadError(`파일이 너무 큽니다. ${mb}MB 이하만 업로드할 수 있습니다.`)
  }

  const type = file.type || ''
  const ext = extensionOf(file.name || '')
  const typeOk = limits.allowed.some(a => (a.endsWith('/') ? type.startsWith(a) : type === a))
  const extOk = limits.allowedExtensions ? limits.allowedExtensions.includes(ext) : false

  if (!typeOk && !extOk) {
    throw new UploadError('허용되지 않는 파일 형식입니다.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return { buffer, contentType: type || 'application/octet-stream', filename: file.name || '' }
}

/**
 * Storage public URL 에서 버킷 내부 경로를 추출한다.
 * 임의 경로 주입을 막기 위해 상위 경로(..)와 절대 경로는 거부한다.
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/${bucket}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return null

  let path = publicUrl.slice(idx + marker.length)
  try {
    path = decodeURIComponent(path)
  } catch {
    return null
  }

  if (!path || path.startsWith('/') || path.includes('..')) return null
  return path
}

/** 파일명에 쓸 안전한 확장자. */
export function safeExtension(filename: string, fallback: string): string {
  const ext = extensionOf(filename)
  return ext.slice(0, 5) || fallback
}
