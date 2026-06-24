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

export async function createProgram(
  orgId: number,
  payload: ProgramCreatePayload,
): Promise<Program> {
  const id = payload.id ?? `prog-${orgId}-${Date.now()}`
  const { id: _omit, ...rest } = payload
  const row = {
    id,
    organization_id: orgId,
    ...rest,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('programs')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as Program
}

export async function updateProgram(
  programId: string,
  ownerOrgId: number,
  payload: ProgramUpdatePayload,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('programs')
    .select('organization_id')
    .eq('id', programId)
    .single()
  if (fetchErr) throw fetchErr
  if (!existing) throw new Error('프로그램을 찾을 수 없습니다.')
  if (existing.organization_id !== ownerOrgId) {
    throw new Error('본인 기관의 프로그램만 수정할 수 있습니다.')
  }

  const { error } = await supabase
    .from('programs')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', programId)
  if (error) throw error
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
  const blob = await compressImage(file)
  const path = `${orgId}/${programId}-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('program-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('program-images').getPublicUrl(path)
  return data.publicUrl
}
