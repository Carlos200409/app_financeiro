import { createClient } from '@supabase/supabase-js'

// Valida no servidor que a requisição veio de um usuário logado. Sem isso, as
// rotas de IA ficariam abertas e qualquer um poderia queimar os créditos Claude.
// O cliente manda o token da sessão no header Authorization: Bearer <token>.
export async function isAuthenticated(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase.auth.getUser(token)
    return !error && !!data.user
  } catch {
    return false
  }
}
