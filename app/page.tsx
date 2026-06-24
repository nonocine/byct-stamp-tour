'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MapPin, Calendar, Award, ChevronRight, Stamp, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import { useAuth } from '@/components/AuthProvider'
import PushNotificationButton from '@/components/PushNotificationButton'

export default function HomePage() {
  const { profile, loading } = useAuth()
  const [stampCount, setStampCount] = useState(0)

  useEffect(() => {
    if (!profile) { setStampCount(0); return }
    supabase
      .from('stamp_records')
      .select('center_id', { count: 'exact', head: false })
      .eq('participant_phone', profile.phone)
      .then(({ data }) => {
        // 기관 중복 제거 후 카운트
        const uniqueOrgs = new Set((data ?? []).map((r: any) => r.center_id))
        setStampCount(uniqueOrgs.size)
      })
  }, [profile])

  const progress = Math.round((stampCount / 17) * 100)

  const displayPhone = profile?.phone
    ? profile.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
    : ''

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 히어로 배너 */}
      <div className="relative overflow-hidden rounded-3xl text-white" style={{ backgroundColor: '#1a3a8c' }}>
        {/* 배경 원형 패턴 */}
        <div className="absolute top-[-60px] right-[-60px] w-64 h-64 rounded-full border-[40px] border-white/[0.06]" />
        <div className="absolute bottom-[-30px] left-[-40px] w-48 h-48 rounded-full border-[30px] border-white/[0.05]" />
        <div className="absolute top-1/2 right-[30%] w-20 h-20 rounded-full border-[14px] border-white/[0.04]" />

        {/* 스탬프 도장 원형 장식 (오른쪽) */}
        <div className="absolute right-4 top-0 bottom-12 flex flex-col justify-center gap-2.5 pointer-events-none">
          <div className="w-[54px] h-[54px] rounded-full border-2 border-dashed border-blue-300/50 bg-blue-400/20 flex flex-col items-center justify-center">
            <span className="text-sm font-black leading-none text-blue-100">01</span>
            <span className="text-[7px] text-blue-200/70 tracking-widest font-bold mt-0.5">STAMP</span>
          </div>
          <div className="w-[54px] h-[54px] rounded-full border-2 border-dashed border-orange-300/60 bg-orange-400/25 flex flex-col items-center justify-center">
            <span className="text-sm font-black leading-none text-orange-100">07</span>
            <span className="text-[7px] text-orange-200/70 tracking-widest font-bold mt-0.5">STAMP</span>
          </div>
          <div className="w-[54px] h-[54px] rounded-full border-2 border-dashed border-green-300/60 bg-green-400/25 flex flex-col items-center justify-center">
            <span className="text-sm font-black leading-none text-green-100">17</span>
            <span className="text-[7px] text-green-200/70 tracking-widest font-bold mt-0.5">STAMP</span>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="relative px-6 pt-6 pb-5 pr-[80px]">
          {/* 운영기관 로고 */}
          <div className="flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 w-fit mb-3">
            <div className="flex items-end gap-0.5" style={{ height: '18px' }}>
              <div style={{ width: '5px', height: '12px', background: '#f5a623', borderRadius: '1px' }} />
              <div style={{ width: '7px', height: '16px', background: '#1e40af', borderRadius: '1px' }} />
              <div style={{ width: '5px', height: '12px', background: '#4caf50', borderRadius: '1px' }} />
            </div>
            <span className="text-white text-xs font-medium">부산광역시청소년수련시설협회</span>
          </div>

          {/* 2026 부산 태그 */}
          <div className="mb-2">
            <span className="inline-block bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
              2026 부산
            </span>
          </div>

          {/* 메인 타이틀 */}
          <h1 className="text-3xl font-bold text-white leading-tight mb-2 whitespace-nowrap">
            B.Y.C.T 스탬프투어
          </h1>

          {/* 서브텍스트 */}
          <p className="text-sm text-blue-100/90 mb-5 leading-relaxed">
            부산 17개 기관을 체험하고<br />
            스탬프를 모아 완주 인증을 받으세요!
          </p>

          {/* 버튼 */}
          <div className="flex items-center gap-3">
            {!loading && !profile && (
              <Link
                href="/login"
                className="flex items-center gap-1.5 bg-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
                style={{ color: '#1a3a8c' }}
              >
                지금 참가하기
                <ChevronRight size={15} />
              </Link>
            )}
            <Link
              href="/programs"
              className="flex items-center gap-1.5 border border-white/50 text-white font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              프로그램 보기
            </Link>
          </div>
        </div>

        {/* 하단 정보바 */}
        <div className="bg-black/25 px-6 py-2.5 flex items-center justify-around">
          <span className="text-xs text-white/80 font-medium">🏢 17개 참여기관</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="text-xs text-white/80 font-medium">📅 6월~11월</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="text-xs text-white/80 font-medium">📍 부산 전역</span>
        </div>
      </div>

      {/* 내 현황 카드 */}
      {!loading && (
        profile ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">참가자</p>
                <p className="text-lg font-bold text-gray-900">{profile.name} 님</p>
                <p className="text-sm text-gray-500">{displayPhone}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-blue-600">{stampCount}</p>
                <p className="text-xs text-gray-500">/ 17 스탬프</p>
              </div>
            </div>

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

            {/* 참여 안내 */}
            <div className="mt-4 flex items-start gap-1.5 text-xs text-orange-500 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <Info size={13} className="flex-shrink-0 mt-0.5 text-orange-500" />
              <p>스탬프투어는 기관당 1개 프로그램만 참여 가능합니다. 동일 기관 중복 신청 및 중복 스탬프 발급은 불가합니다.</p>
            </div>

            <Link
              href="/stamps"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 font-semibold text-sm rounded-xl hover:bg-blue-100 transition-colors"
            >
              <Stamp size={15} />
              내 스탬프 보기
            </Link>

            {/* 알림 구독 */}
            <div className="mt-3">
              <PushNotificationButton />
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-amber-900 mb-1">로그인이 필요해요!</p>
            <p className="text-xs text-amber-700 mb-3">
              로그인하면 스탬프를 모으고 완주 인증을 받을 수 있어요.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
            >
              로그인 / 회원가입 →
            </Link>
          </div>
        )
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
          <p className="text-xl font-black text-gray-900">6~11월</p>
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
              href={`/programs?center=${org.id}`}
              className="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <OrgIcon org={org} size={40} rounded="rounded-xl" />
              <p className="text-xs text-gray-600 text-center leading-tight font-medium">
                {org.name.slice(0, 5)}
              </p>
            </Link>
          ))}
        </div>
        <Link
          href="/programs"
          className="block text-center text-xs text-gray-500 mt-2 cursor-pointer hover:text-blue-600 hover:underline transition-colors"
        >
          외 9개 기관 더보기 →
        </Link>
      </div>

      {/* 운영 안내 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 mb-3">투어 참여 방법</h2>
        <div className="space-y-3">
          {[
            { step: '01', title: '회원가입 & 로그인', desc: '전화번호와 생년월일로 간편하게 가입해요' },
            { step: '02', title: '기관 방문 & 체험', desc: '17개 기관의 프로그램을 체험해요.\n프로그램 신청은 해당 기관 사이트에서 한번 더 해주세요' },
            { step: '03', title: '별점 평가 & 스탬프', desc: '체험 후 기관 담당자가 스탬프를 찍고 만족도 평가를 해요' },
            { step: '04', title: '완주 인증', desc: '17개 모두 수집하면 완주 인증서를 받아요! 가장 많은 스탬프를 모은 청소년에게 포상\n📜 스탬프 3개 이상 획득시 수료증 발급' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-xs font-black">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 whitespace-pre-line">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
