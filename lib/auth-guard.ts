import { createClient } from '@supabase/supabase-js'

// Valida no servidor que a requisição veio de um usuário logado. Sem isso, as
// rotas de IA ficariam abertas e qualquer um poderia queimar os créditos Claude.
// O cliente manda o token da sessão no header Authorization: Bearer <token>.
// Retorna o id do usuário logado (ou null). É o que escopa os dados no
// multi-tenant — cada rota usa esse id pra ler/gravar SÓ a linha do dono.
export async function getUserId(request: Request): Promise<string | null> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase.auth.getUser(token)
    return error ? null : (data.user?.id ?? null)
  } catch {
    return null
  }
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  return (await getUserId(request)) !== null
}
