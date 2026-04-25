export type ParticipantType = 'general' | 'youth'

export interface Participant {
  id: string
  name: string
  school: string
  contact: string
  type: ParticipantType
  grade?: string
  created_at?: string
}

export interface Organization {
  id: number
  name: string
  shortName: string
  description: string
  location: string
  category: string
  color: string
  bgColor: string
  textColor: string
  logo?: string
}

export interface Program {
  id: string
  organization_id: number
  name: string
  description: string
  date: string
  time: string
  capacity: number
  location: string
  target: string
}

export interface Stamp {
  id: string
  participant_id: string
  program_id: string
  organization_id: number
  rating: number
  review?: string
  program_name: string
  created_at: string
}

export interface StampWithOrg extends Stamp {
  organization: Organization
}
