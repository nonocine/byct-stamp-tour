'use client'
import type { Organization } from '@/lib/types'
import { useOrgLogos } from '@/components/OrgLogosProvider'

interface OrgIconProps {
  org: Organization
  /** px 단위 크기 (width = height) */
  size: number
  /** Tailwind rounded class */
  rounded?: string
  className?: string
}

/**
 * 기관 아이콘: DB(organization_logos)에 로고가 있으면 그걸 우선,
 * 없으면 lib/data.ts 의 정적 logo, 그것도 없으면 색상 + 이니셜.
 */
export default function OrgIcon({ org, size, rounded = 'rounded-xl', className = '' }: OrgIconProps) {
  const { logos } = useOrgLogos()
  const logoUrl = logos[org.id] ?? org.logo ?? null

  const base = `flex items-center justify-center flex-shrink-0 overflow-hidden ${rounded} ${className}`

  if (logoUrl) {
    return (
      <div
        className={`${base} bg-white`}
        style={{
          width: size,
          height: size,
          border: `1.5px solid ${org.color}33`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={org.name}
          style={{ width: size - 6, height: size - 6, objectFit: 'contain' }}
        />
      </div>
    )
  }

  return (
    <div
      className={`${base} text-white font-bold`}
      style={{
        width: size,
        height: size,
        backgroundColor: org.color,
        fontSize: Math.max(10, Math.floor(size * 0.28)),
      }}
    >
      {org.shortName.slice(0, 2)}
    </div>
  )
}
