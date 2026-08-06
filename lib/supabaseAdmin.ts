/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 *
 * ⚠️ 이 모듈을 클라이언트 컴포넌트에서 import 하면 안 된다.
 *    service_role 키는 RLS를 우회하므로 브라우저에 노출되면 DB 전체가 열린다.
 *    API 라우트(app/api/**)에서만 사용할 것.
 *
 * lib/supabase.ts (anon key) 와의 역할 분담:
 *   - lib/supabase.ts      : 브라우저용. RLS 적용 대상.
 *   - lib/supabaseAdmin.ts : 서버용. RLS 우회. 인가는 호출하는 라우트가 책임진다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin 은 서버에서만 사용할 수 있습니다.')
  }
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. ' +
        '.env.local 과 Vercel 환경변수에 등록해주세요.',
    )
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
