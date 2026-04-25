import type { Organization } from '@/lib/types'

interface OrgIconProps {
  org: Organization
  /** px 단위 크기 (width = height) */
  size: number
  /** Tailwind rounded class */
  rounded?: string
  className?: string
}

/**
 * 기관 아이콘: 로고 이미지가 있으면 흰 배경에 로고 표시,
 * 없으면 기관 색상 배경에 이니셜 표시.
 */
export default function OrgIcon({ org, size, rounded = 'rounded-xl', className = '' }: OrgIconProps) {
  const base = `flex items-center justify-center flex-shrink-0 overflow-hidden ${rounded} ${className}`

  if (org.logo) {
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
          src={org.logo}
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
