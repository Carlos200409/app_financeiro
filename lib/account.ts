import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { normBR } from './phone'

// Resolução de conta pro caminho de máquina (WhatsApp/ingest), que roda com
// service-role e NÃO tem RLS — o escopo por usuário é imposto aqui, no código.
function service(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// Telefone (como a Meta manda) → user_id do dono. null se não vinculado.
export async function userIdForPhone(rawPhone: string): Promise<string | null> {
  const db = service()
  const phone = normBR(rawPhone)
  if (!db || !phone) return null
  const { data } = await db.from('phone_links').select('user_id').eq('phone', phone).maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

// Onboarding: o usuário manda o código gerado no app, do próprio número (prova
// posse). Se o código existe, vincula telefone→usuário e queima o código.
export async function tryLinkByCode(rawPhone: string, text: string): Promise<boolean> {
  const db = service()
  const code = (text ?? '').trim().toUpperCase()
  const phone = normBR(rawPhone)
  if (!db || !phone || !/^[A-Z0-9]{4,8}$/.test(code)) return false
  const { data: row } = await db.from('link_codes').select('user_id').eq('code', code).maybeSingle()
  if (!row) return false
  await db.from('phone_links').upsert({ phone, user_id: row.user_id }, { onConflict: 'phone' })
  await db.from('link_codes').delete().eq('code', code)
  return true
}
