'use client'
import { supabase } from './supabase'

// Headers pras rotas /api incluindo o token da sessão, pra o servidor confirmar
// que é você (logado) antes de chamar a IA.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
