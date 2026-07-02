'use client'
import { useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Tela de login. Só quem tem conta (você) passa daqui — é o que fecha o acesso
// aos seus dados. A senha é digitada por você; nunca sai pro código.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou senha incorretos.')
    setLoading(false)
    // Sucesso: o onAuthStateChange no DataProvider assume e carrega o app.
  }

  return (
    <div className="min-h-screen bg-[#070711] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4d8dff] to-[#9966ff] flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Finance</span>
        </div>

        <form onSubmit={submit} className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-[#7070a0] mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#4d8dff]/60"
            />
          </div>
          <div>
            <label className="text-xs text-[#7070a0] mb-1 block">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#4d8dff]/60"
            />
          </div>

          {error && <p className="text-[#f87171] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#4d8dff] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#3d7dee] transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-[#505070] mt-4">Seus dados são privados e protegidos por login.</p>
      </div>
    </div>
  )
}
