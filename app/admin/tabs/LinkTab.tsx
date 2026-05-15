'use client'
import { useEffect, useState } from 'react'
import { Link2, ExternalLink, RefreshCw, Save, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import OrgIcon from '@/components/OrgIcon'
import type { AdminUser } from '@/components/AdminProvider'

interface Props {
  admin: AdminUser
}

export default function LinkTab({ admin }: Props) {
  const [linkUrls, setLinkUrls] = useState<Record<number, string>>({})
  const [linksLoading, setLinksLoading] = useState(false)
  const [savingLinkId, setSavingLinkId] = useState<number | null>(null)
  const [savedLinkId, setSavedLinkId] = useState<number | null>(null)

  async function loadCenterLinks() {
    setLinksLoading(true)
    try {
      const { data } = await supabase.from('centers').select('id, program_url')
      const map: Record<number, string> = {}
      ORGANIZATIONS.forEach(o => { map[o.id] = '' })
      ;(data ?? []).forEach((c: any) => {
        if (c.program_url) map[c.id] = c.program_url
      })
      setLinkUrls(map)
    } finally {
      setLinksLoading(false)
    }
  }

  async function saveCenterLink(orgId: number) {
    if (admin.role === 'center' && admin.center_id !== orgId) return
    setSavingLinkId(orgId)
    setSavedLinkId(null)
    try {
      const url = (linkUrls[orgId] ?? '').trim()
      const org = ORGANIZATIONS.find(o => o.id === orgId)
      const { error } = await supabase.from('centers').upsert({
        id: orgId,
        name: org?.name ?? '',
        program_url: url || null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setSavedLinkId(orgId)
      setTimeout(() => setSavedLinkId(curr => (curr === orgId ? null : curr)), 1500)
    } catch (e: any) {
      alert('저장 실패: ' + (e.message ?? ''))
    } finally {
      setSavingLinkId(null)
    }
  }

  useEffect(() => {
    loadCenterLinks()
  }, [])

  return (
    <div className="px-4 space-y-4">
      {admin.role === 'center' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{admin.center_name ?? '본인 기관'}</span>의 신청 링크만 수정할 수 있습니다.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Link2 size={15} /> 프로그램 신청 링크
          </h2>
          <button onClick={loadCenterLinks} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={13} className={linksLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {linksLoading ? (
          <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ORGANIZATIONS
              .filter(org => admin.role === 'super' || admin.center_id === org.id)
              .map(org => {
                const editable = admin.role === 'super' || admin.center_id === org.id
                const url = linkUrls[org.id] ?? ''
                const saving = savingLinkId === org.id
                const justSaved = savedLinkId === org.id
                return (
                  <div key={org.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <OrgIcon org={org} size={28} rounded="rounded-lg" />
                      <p className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{org.name}</p>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                          title="링크 열기"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={e => setLinkUrls(prev => ({ ...prev, [org.id]: e.target.value }))}
                        placeholder="https://..."
                        disabled={!editable}
                        className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                      {editable && (
                        <button
                          onClick={() => saveCenterLink(org.id)}
                          disabled={saving}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${
                            justSaved
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95'
                          }`}
                        >
                          {saving
                            ? <RefreshCw size={12} className="animate-spin" />
                            : justSaved
                              ? <CheckCircle size={12} />
                              : <Save size={12} />}
                          {saving ? '저장 중' : justSaved ? '저장됨' : '저장'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center px-2">
        저장된 링크는 참가자 화면의 "프로그램 신청하기" 버튼에 사용됩니다.
      </p>
    </div>
  )
}
