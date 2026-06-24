'use client'
import { useEffect, useState } from 'react'
import {
  Phone, Search, RefreshCw, XCircle, CheckCircle, UserCheck, Stamp, Trash2, Clock, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import type { AdminUser } from '@/components/AdminProvider'
import {
  formatPhone,
  formatBirthdate,
  formatDate,
  type ProfileResult,
} from './shared'

interface Props {
  admin: AdminUser
}

export default function StampTab({ admin }: Props) {
  const [searchPhone, setSearchPhone] = useState('')
  const [foundProfile, setFoundProfile] = useState<ProfileResult | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    admin.role === 'center' ? (admin.center_id ?? null) : null,
  )
  const [alreadyStamped, setAlreadyStamped] = useState(false)
  const [existingStampId, setExistingStampId] = useState<string | null>(null)
  const [existingStampDate, setExistingStampDate] = useState<string | null>(null)
  const [hasReview, setHasReview] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [stamping, setStamping] = useState(false)
  const [stampSuccess, setStampSuccess] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  // 별도 "스탬프 취소" 섹션 전용 state
  const [cancelSearchPhone, setCancelSearchPhone] = useState('')
  const [cancelSearching, setCancelSearching] = useState(false)
  const [cancelSearchError, setCancelSearchError] = useState('')
  const [cancelTarget, setCancelTarget] = useState<{
    stampId: string
    stampedAt: string
    name: string
    phone: string
    birthdate: string
    participantId: string
    centerId: number
    centerName: string
  } | null>(null)
  const [cancelProcessing, setCancelProcessing] = useState(false)
  const [cancelDoneMsg, setCancelDoneMsg] = useState(false)

  useEffect(() => {
    if (admin.role === 'center' && admin.center_id) {
      setSelectedOrgId(admin.center_id)
    }
  }, [admin])

  async function checkDuplicate(profileId: string, orgId: number) {
    const { data } = await supabase
      .from('stamp_records')
      .select('id, stamped_at')
      .eq('participant_id', profileId)
      .eq('center_id', orgId)
      .maybeSingle()
    setAlreadyStamped(!!data)
    setExistingStampId(data?.id ?? null)
    setExistingStampDate(data?.stamped_at ?? null)
  }

  // 해당 참가자가 해당 기관에 만족도 평가를 완료했는지 확인
  async function checkReview(profileId: string, orgId: number) {
    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('participant_id', profileId)
      .eq('center_id', orgId)
      .maybeSingle()
    setHasReview(!!data)
  }

  function resetStampStatus() {
    setAlreadyStamped(false)
    setExistingStampId(null)
    setExistingStampDate(null)
    setHasReview(false)
    setStampSuccess(false)
    setCancelSuccess(false)
  }

  async function handleSearch() {
    if (!searchPhone) return
    setSearching(true)
    setSearchError('')
    setFoundProfile(null)
    resetStampStatus()
    try {
      const raw = searchPhone.replace(/\D/g, '')
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, phone, birthdate')
        .eq('phone', raw)
        .maybeSingle()
      if (error) throw error
      if (!profile) { setSearchError('해당 전화번호로 등록된 참여자가 없습니다'); return }
      setFoundProfile(profile)
      if (admin.role === 'center' && admin.center_id) {
        await checkDuplicate(profile.id, admin.center_id)
        await checkReview(profile.id, admin.center_id)
      }
      if (admin.role === 'super' && selectedOrgId) {
        await checkDuplicate(profile.id, selectedOrgId)
        await checkReview(profile.id, selectedOrgId)
      }
    } catch (e: any) {
      setSearchError(e.message ?? '오류가 발생했습니다')
    } finally {
      setSearching(false)
    }
  }

  async function handleOrgSelect(orgId: number) {
    setSelectedOrgId(orgId)
    resetStampStatus()
    if (foundProfile) {
      await checkDuplicate(foundProfile.id, orgId)
      await checkReview(foundProfile.id, orgId)
    }
  }

  async function handleStamp() {
    if (!foundProfile || !selectedOrgId) return
    const org = ORGANIZATIONS.find(o => o.id === selectedOrgId)
    if (!org) return
    // 만족도 평가 완료 여부 확인 — 미완료 시 발급 차단
    if (!hasReview) {
      alert('해당 참가자가 아직 만족도 평가를 완료하지 않았습니다.')
      return
    }
    setStamping(true)
    setSearchError('')
    try {
      const { data: inserted, error } = await supabase.from('stamp_records').insert({
        participant_id: foundProfile.id,
        participant_name: foundProfile.name,
        participant_phone: foundProfile.phone,
        center_id: selectedOrgId,
        center_name: org.name,
        approved_by: admin.name,
      }).select('id, stamped_at').single()
      if (error) throw error
      setAlreadyStamped(true)
      setStampSuccess(true)
      setCancelSuccess(false)
      setExistingStampId(inserted?.id ?? null)
      setExistingStampDate(inserted?.stamped_at ?? null)
    } catch (e: any) {
      setSearchError(e.message ?? '스탬프 발급에 실패했습니다')
    } finally {
      setStamping(false)
    }
  }

  async function handleCancelStamp() {
    if (!existingStampId || !foundProfile) return
    const orgId = admin.role === 'center' ? admin.center_id : selectedOrgId
    if (!orgId) return
    if (admin.role === 'center' && admin.center_id !== orgId) return

    if (!confirm('이 스탬프를 취소하시겠습니까?\n참가자에게 발급된 스탬프 기록이 삭제됩니다.')) return
    setCancelling(true)
    setSearchError('')
    try {
      const { error } = await supabase.from('stamp_records').delete().eq('id', existingStampId)
      if (error) throw error

      // 신청 기록도 같이 삭제 — 참가자가 처음 상태로 돌아가 재신청 가능
      const { error: appErr } = await supabase
        .from('applications')
        .delete()
        .eq('participant_id', foundProfile.id)
        .eq('center_id', orgId)
      if (appErr) console.warn('[취소] applications 삭제 실패:', appErr.message)

      const orgName = ORGANIZATIONS.find(o => o.id === orgId)?.name ?? '기관'
      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: foundProfile.id,
          title: 'B.Y.C.T 스탬프투어',
          body: `⚠️ ${orgName} 스탬프가 취소되었습니다`,
          tag: `stamp-cancel-${existingStampId}`,
          url: '/stamps',
        }),
      }).catch((err) => console.warn('[push] 발송 실패:', err))

      setAlreadyStamped(false)
      setExistingStampId(null)
      setExistingStampDate(null)
      setStampSuccess(false)
      setCancelSuccess(true)
    } catch (e: any) {
      setSearchError('취소 실패: ' + (e.message ?? ''))
    } finally {
      setCancelling(false)
    }
  }

  async function handleCancelSearch() {
    if (!cancelSearchPhone) return
    const orgId = admin.role === 'center' ? admin.center_id : selectedOrgId
    if (!orgId) {
      setCancelSearchError(admin.role === 'super' ? '먼저 발급 기관을 선택해주세요' : '기관 정보가 없습니다')
      return
    }
    setCancelSearching(true)
    setCancelSearchError('')
    setCancelTarget(null)
    setCancelDoneMsg(false)
    try {
      const raw = cancelSearchPhone.replace(/\D/g, '')
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, phone, birthdate')
        .eq('phone', raw)
        .maybeSingle()
      if (pErr) throw pErr
      if (!profile) { setCancelSearchError('해당 전화번호로 등록된 참여자가 없습니다'); return }

      const { data: stamp, error: sErr } = await supabase
        .from('stamp_records')
        .select('id, stamped_at')
        .eq('participant_id', profile.id)
        .eq('center_id', orgId)
        .maybeSingle()
      if (sErr) throw sErr
      if (!stamp) { setCancelSearchError('해당 기관에서 발급된 스탬프가 없습니다'); return }

      const orgName = ORGANIZATIONS.find(o => o.id === orgId)?.name ?? ''
      setCancelTarget({
        stampId: stamp.id,
        stampedAt: stamp.stamped_at,
        name: profile.name,
        phone: profile.phone,
        birthdate: profile.birthdate ?? '',
        participantId: profile.id,
        centerId: orgId,
        centerName: orgName,
      })
    } catch (e: any) {
      setCancelSearchError(e.message ?? '오류가 발생했습니다')
    } finally {
      setCancelSearching(false)
    }
  }

  async function handleCancelTargetExecute() {
    if (!cancelTarget) return
    if (admin.role === 'center' && admin.center_id !== cancelTarget.centerId) return

    if (!confirm(`"${cancelTarget.name}" 참가자의 스탬프를 취소하시겠습니까?\n발급된 스탬프 기록이 삭제됩니다.`)) return
    setCancelProcessing(true)
    try {
      const { error } = await supabase.from('stamp_records').delete().eq('id', cancelTarget.stampId)
      if (error) throw error

      const { error: appErr } = await supabase
        .from('applications')
        .delete()
        .eq('participant_id', cancelTarget.participantId)
        .eq('center_id', cancelTarget.centerId)
      if (appErr) console.warn('[취소] applications 삭제 실패:', appErr.message)

      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: cancelTarget.participantId,
          title: 'B.Y.C.T 스탬프투어',
          body: `⚠️ ${cancelTarget.centerName} 스탬프가 취소되었습니다`,
          tag: `stamp-cancel-${cancelTarget.stampId}`,
          url: '/stamps',
        }),
      }).catch((err) => console.warn('[push] 발송 실패:', err))

      setCancelTarget(null)
      setCancelSearchPhone('')
      setCancelDoneMsg(true)
    } catch (e: any) {
      alert('취소 실패: ' + (e.message ?? ''))
    } finally {
      setCancelProcessing(false)
    }
  }

  return (
    <div className="px-4 space-y-4">
      {!admin.center_id && admin.role !== 'super' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <p className="text-sm text-amber-700 font-semibold">기관이 지정되지 않은 관리자입니다.</p>
          <p className="text-xs text-amber-600 mt-1">슈퍼관리자에게 기관 배정을 요청하세요.</p>
        </div>
      ) : (
        <>
          {admin.role === 'super' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">발급 기관 선택</label>
              <select
                value={selectedOrgId ?? ''}
                onChange={e => handleOrgSelect(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              >
                <option value="">기관을 선택하세요</option>
                {ORGANIZATIONS.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          {admin.role === 'center' && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700 font-semibold">발급 기관: {admin.center_name}</p>
              <p className="text-xs text-blue-500 mt-0.5">참여자의 전화번호로 검색 후 스탬프를 발급하세요.</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              <Phone size={13} className="inline mr-1" /> 참여자 전화번호
            </label>
            <div className="flex gap-2">
              <input
                type="tel" inputMode="numeric"
                value={searchPhone}
                onChange={e => { setSearchPhone(formatPhone(e.target.value)); setSearchError(''); setFoundProfile(null); resetStampStatus() }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="010-1234-5678"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 tracking-wider"
              />
              <button onClick={handleSearch} disabled={searching || !searchPhone} className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
                {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
            {searchError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <XCircle size={15} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{searchError}</p>
              </div>
            )}
          </div>

          {foundProfile && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <UserCheck size={16} className="text-gray-600" />
                <p className="text-sm font-bold text-gray-900">참여자 확인</p>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                <div className="flex justify-between"><span className="text-xs text-gray-500">이름</span><span className="text-sm font-semibold text-gray-900">{foundProfile.name}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-500">전화번호</span><span className="text-sm text-gray-700">{formatPhone(foundProfile.phone)}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-500">생년월일</span><span className="text-sm text-gray-700">{formatBirthdate(foundProfile.birthdate)}</span></div>
                {selectedOrgId && (
                  <div className="flex justify-between"><span className="text-xs text-gray-500">발급 기관</span><span className="text-sm font-medium text-gray-800">{ORGANIZATIONS.find(o => o.id === selectedOrgId)?.name}</span></div>
                )}
              </div>
              <div className="px-5 pb-5 space-y-2">
                {!selectedOrgId ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">위에서 기관을 먼저 선택해주세요.</div>
                ) : cancelSuccess ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm font-semibold text-green-700">스탬프가 취소되었습니다.</p>
                  </div>
                ) : stampSuccess ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm font-semibold text-green-700">스탬프가 발급되었습니다!</p>
                  </div>
                ) : alreadyStamped ? (
                  <>
                    <span
                      className={`flex w-fit items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${
                        hasReview ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}
                      title={hasReview ? '만족도 평가 완료' : '만족도 평가 미완료'}
                    >
                      {hasReview ? <CheckCircle size={15} /> : <Clock size={15} />}
                      {hasReview ? '평가 완료' : '평가 미완료'}
                    </span>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-amber-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-amber-700">이미 스탬프가 발급된 참여자입니다.</p>
                      </div>
                      {existingStampDate && (
                        <p className="text-xs text-amber-600 mt-1 ml-7">발급일: {formatDate(existingStampDate)}</p>
                      )}
                    </div>
                    <button
                      onClick={handleCancelStamp}
                      disabled={cancelling}
                      className="w-full py-3.5 bg-red-50 text-red-600 border border-red-200 font-bold text-sm rounded-2xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      {cancelling ? '취소 중...' : '스탬프 취소'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 ${
                          hasReview ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                        }`}
                        title={hasReview ? '만족도 평가 완료' : '만족도 평가 미완료'}
                      >
                        {hasReview ? <CheckCircle size={15} /> : <Clock size={15} />}
                        {hasReview ? '평가 완료' : '평가 미완료'}
                      </span>
                      <button onClick={handleStamp} disabled={stamping || !hasReview} className="flex-1 py-4 bg-blue-600 text-white font-bold text-base rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        <Stamp size={18} />
                        {stamping ? '발급 중...' : '스탬프 발급'}
                      </button>
                    </div>
                    {!hasReview && (
                      <a
                        href="/stamps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-orange-50 text-orange-600 border border-orange-200 font-semibold text-xs rounded-xl hover:bg-orange-100 active:scale-95 transition-all"
                      >
                        <ExternalLink size={13} />
                        참가자 평가 작성 화면으로 이동
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── 스탬프 취소 섹션 ────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Trash2 size={14} className="text-red-500" /> 스탬프 취소
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {admin.role === 'center'
                  ? `${admin.center_name ?? '본인 기관'}에서 발급된 스탬프만 취소할 수 있습니다.`
                  : '선택한 기관의 스탬프 기록을 취소합니다.'}
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="tel" inputMode="numeric"
                  value={cancelSearchPhone}
                  onChange={e => {
                    setCancelSearchPhone(formatPhone(e.target.value))
                    setCancelSearchError('')
                    setCancelTarget(null)
                    setCancelDoneMsg(false)
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleCancelSearch()}
                  placeholder="010-1234-5678"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 tracking-wider"
                />
                <button
                  onClick={handleCancelSearch}
                  disabled={cancelSearching || !cancelSearchPhone}
                  className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
                >
                  {cancelSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>

              {cancelSearchError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <XCircle size={15} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{cancelSearchError}</p>
                </div>
              )}

              {cancelDoneMsg && !cancelTarget && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-green-700">스탬프가 취소되었습니다.</p>
                </div>
              )}

              {cancelTarget && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 space-y-2 bg-amber-50/40">
                    <div className="flex justify-between"><span className="text-xs text-gray-500">이름</span><span className="text-sm font-semibold text-gray-900">{cancelTarget.name}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-500">전화번호</span><span className="text-sm text-gray-700">{formatPhone(cancelTarget.phone)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-500">생년월일</span><span className="text-sm text-gray-700">{formatBirthdate(cancelTarget.birthdate)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-500">스탬프 발급일</span><span className="text-sm text-gray-700">{formatDate(cancelTarget.stampedAt)}</span></div>
                  </div>
                  <button
                    onClick={handleCancelTargetExecute}
                    disabled={cancelProcessing}
                    className="w-full py-3.5 bg-red-600 text-white font-bold text-sm hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {cancelProcessing ? '취소 중...' : '스탬프 취소'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
