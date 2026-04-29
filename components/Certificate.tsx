'use client'
import { forwardRef } from 'react'
import { ORGANIZATIONS } from '@/lib/data'

export interface CertificateStamp {
  center_id: number
  center_name: string
  stamped_at: string
}

interface Props {
  participantName: string
  stamps: CertificateStamp[]
  isComplete: boolean
  issueDate: Date
}

function formatKDate(d: Date) {
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`
}

function formatStampDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const Certificate = forwardRef<HTMLDivElement, Props>(function Certificate(
  { participantName, stamps, isComplete, issueDate },
  ref,
) {
  const sortedStamps = [...stamps].sort((a, b) => {
    const ai = ORGANIZATIONS.findIndex(o => o.id === a.center_id)
    const bi = ORGANIZATIONS.findIndex(o => o.id === b.center_id)
    return ai - bi
  })

  // A4 세로: 210mm x 297mm. CSS px 기준 794 x 1123 (96dpi).
  return (
    <div
      ref={ref}
      style={{
        width: 794,
        minHeight: 1123,
        background: '#ffffff',
        padding: '56px 64px',
        fontFamily: '"Noto Sans KR", "Malgun Gothic", -apple-system, BlinkMacSystemFont, sans-serif',
        color: '#111827',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* 상단 로고 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/association-logo.png"
          alt="부산광역시청소년수련시설협회"
          crossOrigin="anonymous"
          style={{
            height: 90,
            objectFit: 'contain',
            display: 'inline-block',
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* 파란 구분선 */}
      <div
        style={{
          height: 4,
          background: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #1d4ed8)',
          borderRadius: 2,
          marginBottom: 36,
        }}
      />

      {/* 제목: "2026 B.Y.C.T 부산 청소년 스탬프투어 참가/완주 인증서" */}
      <p style={{ textAlign: 'center', fontSize: 17, color: '#3b82f6', fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>
        2026 B.Y.C.T 부산 청소년 스탬프투어
      </p>
      <h1
        style={{
          textAlign: 'center',
          fontSize: 50,
          fontWeight: 900,
          letterSpacing: 16,
          color: '#0f172a',
          marginBottom: 8,
        }}
      >
        수 료 증
      </h1>
      <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginBottom: 44 }}>
        Certificate of Completion
      </p>

      {/* 본문 */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 16,
          padding: '32px 36px',
          marginBottom: 32,
        }}
      >
        <p style={{ fontSize: 18, lineHeight: 2.0, textAlign: 'center', margin: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 22, color: '#1d4ed8' }}>{participantName}</span>{' '}
          님은 2026년 B.Y.C.T 부산 청소년 스탬프투어에<br />
          참가하여 <strong>17개 기관 중 {stamps.length}개 기관</strong>을 체험하였음을<br />
          인증합니다.
        </p>
      </div>

      {/* 스탬프 목록 */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 12, textAlign: 'center', letterSpacing: 2 }}>
          체 험 기 관 목 록
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 24,
            rowGap: 8,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
            background: '#ffffff',
          }}
        >
          {sortedStamps.map((s, idx) => (
            <div
              key={s.center_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                padding: '6px 0',
                borderBottom: idx < sortedStamps.length - 2 ? '1px dashed #f1f5f9' : 'none',
              }}
            >
              <span style={{ color: '#0f172a' }}>
                <span style={{ color: '#94a3b8', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                  {String(idx + 1).padStart(2, '0')}.
                </span>
                {s.center_name}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {formatStampDate(s.stamped_at)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 발급 정보 */}
      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 64 }}>
        <p style={{ textAlign: 'center', fontSize: 16, color: '#475569', marginBottom: 18 }}>
          발급일: {formatKDate(issueDate)}
        </p>
        {/* 협회명 + 도장: 같은 라인에 나란히 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <p
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: 2,
              margin: 0,
            }}
          >
            부산광역시청소년수련시설협회
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/stamp-seal.png"
            alt="직인"
            crossOrigin="anonymous"
            style={{
              width: 80,
              height: 80,
              objectFit: 'contain',
              imageRendering: 'auto',
              filter: 'contrast(1.5) saturate(1.5)',
              mixBlendMode: 'multiply',
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  )
})

export default Certificate
