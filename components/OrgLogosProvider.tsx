'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchOrgLogos, type OrgLogoMap } from '@/lib/orgLogos'

interface OrgLogosContextValue {
  logos: OrgLogoMap
  refresh: () => Promise<void>
}

const OrgLogosContext = createContext<OrgLogosContextValue>({
  logos: {},
  refresh: async () => {},
})

export function OrgLogosProvider({ children }: { children: React.ReactNode }) {
  const [logos, setLogos] = useState<OrgLogoMap>({})

  const refresh = useCallback(async () => {
    const next = await fetchOrgLogos()
    setLogos(next)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <OrgLogosContext.Provider value={{ logos, refresh }}>
      {children}
    </OrgLogosContext.Provider>
  )
}

export function useOrgLogos() {
  return useContext(OrgLogosContext)
}
