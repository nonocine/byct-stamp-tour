import { supabase } from './supabase'
import type { Program } from './types'

export async function fetchAllPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('organization_id', { ascending: true })
    .order('date', { ascending: true })
  if (error) {
    console.error('[fetchAllPrograms]', error)
    return []
  }
  return (data ?? []) as Program[]
}

export async function fetchProgramsByOrg(orgId: number): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('organization_id', orgId)
    .order('date', { ascending: true })
  if (error) {
    console.error('[fetchProgramsByOrg]', error)
    return []
  }
  return (data ?? []) as Program[]
}

export interface ProgramUpdatePayload {
  title: string
  description: string
  date: string
  time: string
  capacity: number
  target: string
  image_url?: string | null
  application_url?: string | null
}

export interface ProgramCreatePayload extends ProgramUpdatePayload {
  id?: string
  location: string
}

/** 라우트 응답에서 에러 메시지를 뽑아낸다. */
async function readError(res: Response, fallback: string): Promise<string> {
  const payload = await res.json().catch(() => null)
  return payload?.error ?? fallback
}

// programs 쓰기는 RLS로 차단되어 있다. 생성/수정은 관리자 세션을 검증하는
// /api/admin/programs 가 service_role 로 수행한다.
// 읽기(fetchAllPrograms / fetchProgramsByOrg)는 공개 정책이 남아 있어 그대로 둔다.

export async function createProgram(
  orgId: number,
  payload: ProgramCreatePayload,
): Promise<Program> {
  const { location: _ignored, ...rest } = payload
  const res = await fetch('/api/admin/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...rest, organization_id: orgId }),
  })
  if (!res.ok) throw new Error(await readError(res, '프로그램 생성에 실패했습니다.'))
  const data = await res.json()
  return data.program as Program
}

export async function updateProgram(
  programId: string,
  _ownerOrgId: number,
  payload: ProgramUpdatePayload,
): Promise<void> {
  // 소유 기관 검사는 서버가 DB 값을 기준으로 수행한다.
  const res = await fetch('/api/admin/programs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, id: programId }),
  })
  if (!res.ok) throw new Error(await readError(res, '프로그램 수정에 실패했습니다.'))
}

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82

export async function compressImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('이미지 로드 실패'))
    i.src = dataUrl
  })

  const ratio = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 컨텍스트를 생성할 수 없습니다.')
  ctx.drawImage(img, 0, 0, w, h)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export async function uploadProgramImage(
  programId: string,
  orgId: number,
  file: File,
): Promise<string> {
  // 압축은 canvas 가 필요하므로 브라우저에 남기고, 결과만 서버로 보낸다.
  // program-images 버킷은 anon 쓰기가 차단되어 있다.
  const blob = await compressImage(file)

  const form = new FormData()
  form.append('file', blob, `${programId}.jpg`)
  form.append('programId', programId)
  form.append('orgId', String(orgId))

  const res = await fetch('/api/admin/programs/image', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res, '이미지 업로드에 실패했습니다.'))

  const data = await res.json()
  return data.image_url as string
}
