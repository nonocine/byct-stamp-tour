import { supabase } from './supabase'

export type OrgLogoMap = Record<number, string>

export async function fetchOrgLogos(): Promise<OrgLogoMap> {
  const { data, error } = await supabase
    .from('organization_logos')
    .select('center_id, logo_url')

  if (error) {
    console.warn('[orgLogos] fetch 실패:', error.message)
    return {}
  }

  const map: OrgLogoMap = {}
  for (const row of data ?? []) {
    if (row.logo_url) map[row.center_id] = row.logo_url
  }
  return map
}
