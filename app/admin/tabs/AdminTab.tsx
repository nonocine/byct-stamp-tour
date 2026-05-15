'use client'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Shield, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ORGANIZATIONS } from '@/lib/data'
import type { AdminUser } from '@/components/AdminProvider'
import { formatPhone, type AdminRow } from './shared'

interface AdminGroup {
  key: string
  label: string
  isSuper: boolean
  members: AdminRow[]
}

interface Props {
  admin: AdminUser
}

export default function AdminTab({ admin }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', password: '', role: 'center' as 'super' | 'center', center_id: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleSection(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groups = useMemo<AdminGroup[]>(() => {
    const supers = admins.filter(a => a.role === 'super')
    const centers = admins.filter(a => a.role !== 'super')

    const orgGroups: AdminGroup[] = ORGANIZATIONS
      .map(org => ({
        key: `org-${org.id}`,
        label: org.name,
        isSuper: false,
        members: centers.filter(a => a.center_id === org.id),
      }))
      .filter(g => g.members.length > 0)

    // 기관 미지정 센터관리자 (방어적 — RLS/데이터 오류로 발생 가능)
    const orphans = centers.filter(a => !ORGANIZATIONS.some(o => o.id === a.center_id))
    if (orphans.length > 0) {
      orgGroups.push({
        key: 'org-unassigned',
        label: '기관 미지정',
        isSuper: false,
        members: orphans,
      })
    }

    const result: AdminGroup[] = []
    if (supers.length > 0) {
      result.push({
        key: 'super',
        label: '협회 (슈퍼관리자)',
        isSuper: true,
        members: supers,
      })
    }
    return result.concat(orgGroups)
  }, [admins])

  async function loadAdmins() {
    setAdminsLoading(true)
    const { data } = await supabase.from('admins').select('id, name, phone, role, center_id, center_name').order('role')
    setAdmins(data ?? [])
    setAdminsLoading(false)
  }

  async function handleAddAdmin() {
    setAdminError('')
    const { name, phone, password, role, center_id } = newAdmin
    if (!name || !phone || !password) { setAdminError('이름, 전화번호, 비밀번호를 입력해주세요'); return }
    if (role === 'center' && !center_id) { setAdminError('기관을 선택해주세요'); return }
    setAddingAdmin(true)
    try {
      const raw = phone.replace(/\D/g, '')
      const org = ORGANIZATIONS.find(o => o.id === Number(center_id))
      const { error } = await supabase.from('admins').insert({
        name, phone: raw, password, role,
        center_id: role === 'center' ? Number(center_id) : null,
        center_name: role === 'center' ? (org?.name ?? '') : null,
      })
      if (error) throw error
      setNewAdmin({ name: '', phone: '', password: '', role: 'center', center_id: '' })
      loadAdmins()
    } catch (e: any) {
      setAdminError(e.message ?? '추가에 실패했습니다')
    } finally {
      setAddingAdmin(false)
    }
  }

  async function handleDeleteAdmin(id: string) {
    if (!confirm('이 관리자를 삭제할까요?')) return
    await supabase.from('admins').delete().eq('id', id)
    loadAdmins()
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  return (
    <div className="px-4 space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Plus size={15} /> 관리자 추가</h2>
        <input type="text" value={newAdmin.name} onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))} placeholder="이름" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        <input type="tel" inputMode="numeric" value={newAdmin.phone} onChange={e => setNewAdmin(p => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="전화번호" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-gray-800" />
        <input type="password" value={newAdmin.password} onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))} placeholder="비밀번호" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        <select value={newAdmin.role} onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value as 'super' | 'center', center_id: '' }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
          <option value="center">센터관리자</option>
          <option value="super">슈퍼관리자</option>
        </select>
        {newAdmin.role === 'center' && (
          <select value={newAdmin.center_id} onChange={e => setNewAdmin(p => ({ ...p, center_id: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
            <option value="">기관 선택</option>
            {ORGANIZATIONS.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        )}
        {adminError && <p className="text-xs text-red-500">{adminError}</p>}
        <button onClick={handleAddAdmin} disabled={addingAdmin} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
          {addingAdmin ? '추가 중...' : '관리자 추가'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Shield size={15} /> 관리자 목록</h2>
          <button onClick={loadAdmins} className="text-gray-400 hover:text-gray-600 transition-colors"><RefreshCw size={13} /></button>
        </div>
        {adminsLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">등록된 관리자가 없습니다</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groups.map(group => {
              const isCollapsed = collapsed.has(group.key)
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(group.key)}
                    className={`w-full px-5 py-2.5 flex items-center justify-between text-left transition-colors ${
                      group.isSuper
                        ? 'bg-purple-50/60 hover:bg-purple-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm font-bold truncate ${group.isSuper ? 'text-purple-700' : 'text-gray-700'}`}>
                        {group.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        group.isSuper ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {group.members.length}명
                      </span>
                    </div>
                    {isCollapsed
                      ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                      : <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {group.members.map(a => (
                        <div key={a.id} className="px-5 py-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.role === 'super' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {a.role === 'super' ? '슈퍼' : '센터'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{formatPhone(a.phone)}{a.center_name ? ` · ${a.center_name}` : ''}</p>
                          </div>
                          {a.id !== admin.id && (
                            <button onClick={() => handleDeleteAdmin(a.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
