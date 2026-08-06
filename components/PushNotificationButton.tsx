'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type UiStatus = 'loading' | 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribing'

export default function PushNotificationButton() {
  const { profile } = useAuth()
  const [status, setStatus] = useState<UiStatus>('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission as UiStatus)
  }, [])

  async function handleSubscribe() {
    if (!profile) { alert('로그인 후 이용해주세요.'); return }
    if (!VAPID_PUBLIC_KEY) { alert('VAPID 공개 키가 설정되지 않았습니다. 관리자에게 문의해주세요.'); return }

    setStatus('subscribing')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as UiStatus)
        if (permission === 'denied') {
          alert('알림을 허용하려면 브라우저 설정에서 이 사이트의 알림 권한을 허용해주세요.')
        }
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const json = sub.toJSON()
      const endpoint = json.endpoint
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!endpoint || !p256dh || !auth) {
        throw new Error('구독 정보가 불완전합니다')
      }

      // participant_id 는 보내지 않는다 — 서버가 세션 쿠키에서 꺼낸다.
      const res = await fetch('/api/me/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh, auth }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? '알림 구독 등록에 실패했습니다')
      }

      setStatus('granted')
    } catch (e: any) {
      console.error('[Push] 구독 실패:', e)
      alert(`알림 구독에 실패했습니다: ${e?.message ?? e}`)
      // 권한 자체는 받았을 수 있으니 현재 권한 상태로 복귀
      try { setStatus(Notification.permission as UiStatus) } catch { setStatus('default') }
    }
  }

  if (status === 'loading') return null

  if (status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 text-gray-500 rounded-2xl border border-gray-100 text-xs">
        <BellOff size={14} />
        이 브라우저는 푸시 알림을 지원하지 않아요.
      </div>
    )
  }

  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-2xl border border-green-100 text-xs font-medium">
        <Bell size={14} />
        알림 구독 완료! 신청 상태가 바뀌면 알려드릴게요.
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-xs">
        <BellOff size={14} />
        알림이 차단돼 있어요. 브라우저 설정에서 허용해주세요.
      </div>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={status === 'subscribing' || !profile}
      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'subscribing' ? (
        <>
          <Loader2 size={16} className="animate-spin" /> 구독 중...
        </>
      ) : (
        <>
          <Bell size={16} /> 알림 허용하기
        </>
      )}
    </button>
  )
}
