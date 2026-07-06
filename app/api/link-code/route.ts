import { createClient } from '@supabase/supabase-js'
import { getUserId } from '@/lib/auth-guard'

// Gera um código de vínculo pro usuário logado. Ele manda esse código pro bot
// do próprio WhatsApp (prova posse do número) → o webhook cria o phone_links.

function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I pra não confundir
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function POST(request: Request) {
  const userId = await getUserId(request)
  if (!userId) return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return Response.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  // Um código ativo por usuário: limpa os antigos antes.
  await db.from('link_codes').delete().eq('user_id', userId)
  const code = gerarCodigo()
  const { error } = await db.from('link_codes').insert({ code, user_id: userId })
  if (error) return Response.json({ error: 'Falha ao gerar o código.' }, { status: 500 })
  return Response.json({ code })
}
