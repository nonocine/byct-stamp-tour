'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, ChevronLeft, Phone, School, User, Users } from 'lucide-react'
import { saveParticipant, loadParticipant, clearParticipant } from '@/lib/store'
import type { Participant, ParticipantType } from '@/lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const [existing, setExisting] = useState<Participant | null>(null)
  const [form, setForm] = useState({ name: '', school: '', contact: '', grade: '', type: 'general' as ParticipantType })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = loadParticipant()
    if (p) setExisting(p)
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '이름을 입력해주세요'
    if (!form.school.trim()) e.school = '학교명을 입력해주세요'
    if (!form.contact.trim()) e.contact = '연락처를 입력해주세요'
    else if (!/^[0-9]{10,11}$/.test(form.contact.replace(/-/g, '')))
      e.contact = '올바른 전화번호를 입력해주세요'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const participant: Participant = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      school: form.school.trim(),
      contact: form.contact.trim(),
      grade: form.grade.trim(),
      type: form.type,
      created_at: new Date().toISOString(),
    }
    saveParticipant(participant)
    setSaved(true)
    setTimeout(() => router.push('/programs'), 1500)
  }

  function handleLogout() {
    clearParticipant()
    setExisting(null)
    setSaved(false)
  }

  if (saved) {
    return (
      <div className="px-4 py-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 stamp-appear">
          <UserCheck size={36} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">등록 완료!</h2>
        <p className="text-sm text-gray-500">프로그램 목록으로 이동합니다...</p>
      </div>
    )
  }

  if (existing) {
    return (
      <div className="px-4 py-5">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 text-sm mb-5">
          <ChevronLeft size={16} /> 뒤로가기
        </button>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <UserCheck size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">등록된 참가자</p>
              <p className="text-lg font-bold text-gray-900">{existing.name}</p>
            </div>
          </div>

          <div className="space-y-2.5 mb-5">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <School size={15} className="text-gray-400" />
              <span>{existing.school} {existing.grade && `(${existing.grade})`}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone size={15} className="text-gray-400" />
              <span>{existing.contact}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users size={15} className="text-gray-400" />
              <span>{existing.type === 'general' ? '일반체험단' : '청소년체험단'}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/programs')}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            프로그램 체험하러 가기 →
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
        >
          다른 계정으로 등록하기
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-5">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 text-sm mb-5">
        <ChevronLeft size={16} /> 뒤로가기
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">참가 등록</h1>
        <p className="text-sm text-gray-500 mt-1">정보를 입력하고 스탬프투어를 시작하세요!</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 체험단 유형 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">체험단 유형</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'general', label: '일반체험단', desc: '일반 청소년 누구나' },
              { value: 'youth', label: '청소년체험단', desc: '청소년단체 소속' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: opt.value as ParticipantType }))}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  form.type === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <p className={`text-sm font-semibold ${form.type === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 이름 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <User size={13} className="inline mr-1" />
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="홍길동"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* 학교 + 학년 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <School size={13} className="inline mr-1" />
              학교명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.school}
              onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
              placeholder="부산중학교"
              className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.school ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.school && <p className="text-xs text-red-500 mt-1">{errors.school}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">학년</label>
            <select
              value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              {['초4','초5','초6','중1','중2','중3','고1','고2','고3'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 연락처 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            <Phone size={13} className="inline mr-1" />
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.contact}
            onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
            placeholder="01012345678"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.contact ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          />
          {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
        </div>

        {/* 개인정보 동의 */}
        <div className="bg-gray-50 rounded-xl p-3.5 text-xs text-gray-500 leading-relaxed">
          수집된 개인정보(이름, 학교, 연락처)는 B.Y.C.T 스탬프투어 운영 목적으로만 사용되며,
          행사 종료 후 6개월 이내 파기됩니다.
        </div>

        <button
          type="submit"
          className="w-full py-4 bg-blue-600 text-white font-bold text-base rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200"
        >
          참가 등록하기 🎯
        </button>
      </form>
    </div>
  )
}
