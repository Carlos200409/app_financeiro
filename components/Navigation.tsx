'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, TrendingUp, BarChart3, Sparkles, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/resumo', icon: LayoutDashboard, label: 'Resumo' },
  { href: '/analise', icon: Sparkles, label: 'Analisar' },
  { href: '/gastos', icon: CreditCard, label: 'Gastos' },
  { href: '/investir', icon: TrendingUp, label: 'Investir' },
  { href: '/historico', icon: BarChart3, label: 'Histórico' },
]

export default function Navigation() {
  const path = usePathname()
  const sair = async () => {
    await supabase.auth.signOut()
    // O DataProvider detecta a sessão encerrada e mostra o Login.
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#0d0d1a] border-r border-[#1a1a2e] px-3 py-6 fixed left-0 top-0 bottom-0 z-30">
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4d8dff] to-[#9966ff] flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Finance</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  active
                    ? 'bg-[#4d8dff]/15 text-[#4d8dff]'
                    : 'text-[#7070a0] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <button
          onClick={sair}
          className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#7070a0] hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0d0d1a]/95 backdrop-blur border-t border-[#1a1a2e] px-2 pb-safe">
        <div className="flex items-center justify-around py-2">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all"
                style={{ color: active ? '#4d8dff' : '#505070' }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
          <button onClick={sair} className="flex flex-col items-center gap-1 px-2 py-1.5" style={{ color: '#505070' }}>
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </>
  )
}
