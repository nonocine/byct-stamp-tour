'use client'
import type { Participant, Stamp } from './types'

const PARTICIPANT_KEY = 'byct_participant'
const STAMPS_KEY = 'byct_stamps'

export function saveParticipant(p: Participant): void {
  localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(p))
}

export function loadParticipant(): Participant | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(PARTICIPANT_KEY)
  return raw ? (JSON.parse(raw) as Participant) : null
}

export function clearParticipant(): void {
  localStorage.removeItem(PARTICIPANT_KEY)
}

export function saveStamp(stamp: Stamp): void {
  const stamps = loadStamps()
  const existing = stamps.findIndex(s => s.organization_id === stamp.organization_id)
  if (existing >= 0) {
    stamps[existing] = stamp
  } else {
    stamps.push(stamp)
  }
  localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps))
}

export function loadStamps(): Stamp[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STAMPS_KEY)
  return raw ? (JSON.parse(raw) as Stamp[]) : []
}

export function hasStampForOrg(organizationId: number): boolean {
  return loadStamps().some(s => s.organization_id === organizationId)
}
