'use client'
import { Star } from 'lucide-react'
import type { Organization, Stamp } from '@/lib/types'

interface Props {
  organizations: Organization[]
  stamps: Stamp[]
}

export default function StampGrid({ organizations, stamps }: Props) {
  const stampMap = new Map(stamps.map(s => [s.organization_id, s]))

  return (
    <div className="grid grid-cols-3 gap-3">
      {organizations.map(org => {
        const stamp = stampMap.get(org.id)
        const collected = !!stamp

        return (
          <div key={org.id} className="flex flex-col items-center gap-1.5">
            {/* 스탬프 원형 */}
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 overflow-hidden"
                style={
                  collected
                    ? {
                        background: `radial-gradient(circle at 30% 30%, ${org.color}dd, ${org.color})`,
                        boxShadow: `0 4px 16px ${org.color}55`,
                      }
                    : {
                        background: '#F3F4F6',
                        border: '2.5px dashed #D1D5DB',
                      }
                }
              >
                {collected ? (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-white/30 z-10 pointer-events-none" />
                    <div className="absolute inset-2 rounded-full border border-white/20 z-10 pointer-events-none" />

                    {org.logo ? (
                      /* 로고가 있는 경우: 흰 원형 배경 위에 로고 */
                      <div className="flex flex-col items-center gap-0.5 z-10">
                        <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={org.logo}
                            alt={org.name}
                            style={{ width: 38, height: 38, objectFit: 'contain' }}
                          />
                        </div>
                        <div className="flex gap-0.5">
                          {[...Array(stamp.rating)].map((_, i) => (
                            <Star key={i} size={6} fill="white" stroke="none" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* 로고 없는 경우: 이니셜 텍스트 */
                      <>
                        <span className="text-white font-black text-sm leading-none z-10">
                          {org.shortName.slice(0, 3)}
                        </span>
                        <div className="flex gap-0.5 z-10 mt-0.5">
                          {[...Array(stamp.rating)].map((_, i) => (
                            <Star key={i} size={6} fill="white" stroke="none" />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* 미수집 */
                  org.logo ? (
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={org.logo}
                        alt={org.name}
                        style={{ width: 40, height: 40, objectFit: 'contain', filter: 'grayscale(1) opacity(0.3)' }}
                      />
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-300 font-bold text-xs leading-none">
                        {org.shortName.slice(0, 3)}
                      </span>
                      <span className="text-gray-300 text-xs mt-0.5">{org.id}</span>
                    </>
                  )
                )}
              </div>

              {/* 수집 완료 뱃지 */}
              {collected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center z-20">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </div>

            {/* 기관명 */}
            <p
              className="text-xs text-center leading-tight font-medium"
              style={{ color: collected ? org.color : '#9CA3AF' }}
            >
              {org.name.length > 6 ? org.name.slice(0, 6) + '…' : org.name}
            </p>
          </div>
        )
      })}
    </div>
  )
}
