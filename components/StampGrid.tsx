'use client'
import { Star } from 'lucide-react'
import type { Organization } from '@/lib/types'

interface Props {
  organizations: Organization[]
  stampedOrgIds: Set<number>
  reviewedOrgIds?: Set<number>
  onSelect?: (org: Organization, collected: boolean) => void
}

export default function StampGrid({ organizations, stampedOrgIds, reviewedOrgIds, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {organizations.map(org => {
        const collected = stampedOrgIds.has(org.id)
        const reviewed = reviewedOrgIds?.has(org.id) ?? false
        const clickable = !!onSelect

        const Wrapper: any = clickable ? 'button' : 'div'
        const wrapperProps = clickable
          ? {
              type: 'button',
              disabled: !collected,
              onClick: () => onSelect?.(org, collected),
              className: `flex flex-col items-center gap-1.5 ${collected ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-not-allowed opacity-100'}`,
            }
          : { className: 'flex flex-col items-center gap-1.5' }

        return (
          <Wrapper key={org.id} {...wrapperProps}>
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
                      <div className="flex flex-col items-center z-10">
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={org.logo} alt={org.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-white font-black text-sm leading-none z-10">
                        {org.shortName.slice(0, 3)}
                      </span>
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
                      <span className="text-gray-300 font-bold text-xs leading-none">{org.shortName.slice(0, 3)}</span>
                      <span className="text-gray-300 text-xs mt-0.5">{org.id}</span>
                    </>
                  )
                )}
              </div>

              {collected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center z-20">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
              {collected && reviewed && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center z-20 shadow">
                  <Star size={10} className="text-white fill-white" />
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
            {clickable && collected && (
              <p className="text-[10px] text-amber-600 font-semibold leading-none">
                {reviewed ? '평가 완료' : '평가하기'}
              </p>
            )}
          </Wrapper>
        )
      })}
    </div>
  )
}
