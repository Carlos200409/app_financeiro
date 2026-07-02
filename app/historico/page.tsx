'use client'
import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useData } from '@/lib/store'
import { fmt, fmtShort } from '@/lib/format'
import { MONTH_LABELS, MonthKey } from '@/lib/types'

export default function HistoricoPage() {
  const { data } = useData()

  const summaries = useMemo(() => data?.monthlySummaries ?? [], [data?.monthlySummaries])
  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions])

  const chart = useMemo(
    () =>
      summaries
        .filter((s) => s.receita > 0 || s.fixos > 0 || s.extras > 0)
        .map((s) => ({
          name: s.month,
          Renda: s.receita,
          Gastos: (s.fixos ?? 0) + (s.extras ?? 0),
          Saldo: s.saldo,
        })),
    [summaries],
  )

  const totals = useMemo(
    () => ({
      renda: summaries.reduce((a, s) => a + (s.receita ?? 0), 0),
      gastos: summaries.reduce((a, s) => a + (s.fixos ?? 0) + (s.extras ?? 0), 0),
      saldo: summaries.reduce((a, s) => a + (s.saldo ?? 0), 0),
    }),
    [summaries],
  )

  const temDados = chart.length > 0 || transactions.length > 0

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Histórico</h1>
      <p className="text-[#7070a0] text-sm mb-6">Sua evolução mês a mês.</p>

      {!temDados ? (
        <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-8 text-center text-[#7070a0]">
          Ainda não há histórico. Conforme você registra meses, a evolução aparece aqui.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Mini label="Renda total" value={totals.renda} icon={TrendingUp} color="#4ade80" />
            <Mini label="Gastos totais" value={totals.gastos} icon={TrendingDown} color="#f87171" />
            <Mini label="Saldo acumulado" value={totals.saldo} icon={Wallet} color={totals.saldo >= 0 ? '#4d8dff' : '#f87171'} />
          </div>

          {chart.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-4 md:p-5 mb-6">
              <h2 className="text-sm font-semibold mb-4">Renda vs Gastos</h2>
              <div className="h-56 md:h-64 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRenda" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
                    <XAxis dataKey="name" stroke="#505070" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#505070" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtShort(v)} width={54} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="Renda" stroke="#4ade80" strokeWidth={2} fill="url(#gRenda)" />
                    <Area type="monotone" dataKey="Gastos" stroke="#f87171" strokeWidth={2} fill="url(#gGastos)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1a1a2e]">
                <h2 className="text-sm font-semibold">Lançamentos</h2>
              </div>
              <div className="divide-y divide-[#1a1a2e]">
                {transactions.map((t) => {
                  const entrada = t.category === 'receita'
                  return (
                    <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{t.description}</p>
                        <p className="text-xs text-[#505070]">
                          {MONTH_LABELS[t.month as MonthKey] ?? t.month}{t.date ? ` · ${t.date}` : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-medium shrink-0 ${entrada ? 'text-[#4ade80]' : 'text-white'}`}>
                        {entrada ? '' : '-'}{fmt(t.value)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Mini({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Wallet; color: string }) {
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-3 md:p-4">
      <Icon className="w-4 h-4 mb-2" style={{ color }} />
      <p className="text-[10px] md:text-xs text-[#7070a0] mb-0.5">{label}</p>
      <p className="text-sm md:text-lg font-semibold" style={{ color }}>{fmt(value)}</p>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl p-3 shadow-xl text-xs">
      <p className="text-[#7070a0] mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}
