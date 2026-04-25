'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MapPin, Calendar, Award, ChevronRight, Stamp } from 'lucide-react'
import { loadParticipant, loadStamps } from '@/lib/store'
import type { Participant } from '@/lib/types'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'

export default function HomePage() {
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [stampCount, setStampCount] = useState(0)

  useEffect(() => {
    setParticipant(loadParticipant())
    setStampCount(loadStamps().length)
  }, [])

  const progress = Math.round((stampCount / 17) * 100)

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 히어로 배너 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-12 -translate-x-10" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              2026 부산 청소년
            </span>
          </div>
          <h1 className="text-2xl font-black leading-tight mb-1">
            B.Y.C.T<br />
            <span className="text-blue-200">스탬프투어</span>
          </h1>
          <p className="text-sm text-blue-100 mb-5 leading-relaxed">
            부산 17개 기관을 체험하고<br />
            스탬프를 모아 완주 인증을 받으세요!
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-1.5 bg-white text-blue-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
            >
              지금 참가신청
              <ChevronRight size={15} />
            </Link>
            <Link
              href="/programs"
              className="flex items-center gap-1.5 bg-white/15 text-white font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-white/25 transition-colors"
            >
              프로그램 보기
            </Link>
          </div>
        </div>
      </div>

      {/* 내 현황 카드 (로그인된 경우) */}
      {participant ? (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">참가자</p>
              <p className="text-lg font-bold text-gray-900">{participant.name} 님</p>
              <p className="text-sm text-gray-500">{participant.school}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-blue-600">{stampCount}</p>
              <p className="text-xs text-gray-500">/ 17 스탬프</p>
            </div>
          </div>

          {/* 진행 바 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>수집 진행률</span>
              <span className="font-semibold text-blue-600">{progress}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Link
            href="/stamps"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 font-semibold text-sm rounded-xl hover:bg-blue-100 transition-colors"
          >
            <Stamp size={15} />
            내 스탬프 보기
          </Link>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-900 mb-1">참가 등록이 필요해요!</p>
          <p className="text-xs text-amber-700 mb-3">
            이름·학교·연락처를 등록하면 스탬프를 모을 수 있어요.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
          >
            참가 등록하기 →
          </Link>
        </div>
      )}

      {/* 핵심 정보 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <Award className="mx-auto text-yellow-500 mb-1.5" size={22} />
          <p className="text-xl font-black text-gray-900">17</p>
          <p className="text-xs text-gray-500 mt-0.5">참여기관</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <Calendar className="mx-auto text-blue-500 mb-1.5" size={22} />
          <p className="text-xl font-black text-gray-900">7~8월</p>
          <p className="text-xs text-gray-500 mt-0.5">운영기간</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
          <MapPin className="mx-auto text-red-500 mb-1.5" size={22} />
          <p className="text-xl font-black text-gray-900">부산</p>
          <p className="text-xs text-gray-500 mt-0.5">전역</p>
        </div>
      </div>

      {/* 참여 기관 미리보기 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">참여 기관</h2>
          <Link href="/programs" className="text-xs text-blue-600 font-medium">전체보기 →</Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ORGANIZATIONS.slice(0, 8).map(org => (
            <Link
              key={org.id}
              href="/programs"
              className="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <OrgIcon org={org} size={40} rounded="rounded-xl" />
              <p className="text-xs text-gray-600 text-center leading-tight font-medium">
                {org.name.slice(0, 5)}
              </p>
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">외 9개 기관 더보기 →</p>
      </div>

      {/* 운영 안내 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 mb-3">투어 참여 방법</h2>
        <div className="space-y-3">
          {[
            { step: '01', title: '참가 등록', desc: '이름·학교·연락처를 입력해 등록해요' },
            { step: '02', title: '기관 방문 & 체험', desc: '17개 기관의 프로그램을 체험해요' },
            { step: '03', title: '별점 평가 & 스탬프', desc: '체험 후 만족도를 평가하면 스탬프가 찍혀요' },
            { step: '04', title: '완주 인증', desc: '17개 모두 수집하면 완주 인증서를 받아요!' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-xs font-black">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
