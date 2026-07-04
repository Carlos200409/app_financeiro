'use client'
import { useMemo } from 'react'
import { CreditCard, Repeat } from 'lucide-react'
import EmptyCTA from '@/components/EmptyCTA'
import MonthSelector from '@/components/MonthSelector'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { computeSummary } from '@/lib/finance-summary'
import { LEVEL_META as LEVEL } from '@/lib/types'

export default function GastosPage() {
  const { data, currentMonth } = useData()
  const s = useMemo(() => computeSummary(data, currentMonth), [data?.imports, data?.holerites, data?.transactions, currentMonth])

  const assinaturas = useMemo(
    () => (data?.imports ?? []).flatMap((g) => g.transactions).filter((t) => t.amount < 0 && t.recurring),
    [data?.imports],
  )
  const parcelas = useMemo(
    () => (data?.installments ?? []).filter((p) => p.status === 'ATIVO'),
    [data?.installments],
  )

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Gastos</h1>
          <p className="text-[#7070a0] text-sm">Pra onde vai seu dinheiro.</p>
        </div>
        <MonthSelector />
      </div>

      {!s?.temDados && parcelas.length === 0 ? (
        <EmptyCTA title="Sem gastos ainda" text="Sobe um extrato do banco que eu mostro pra onde vai cada real." />
      ) : (
        <>
          {s && s.temDados && (
          <>
          {/* Total + níveis */}
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-sm text-[#7070a0]">Total gasto</span>
              <span className="text-2xl font-bold">{fmt(s.gastos)}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden mb-3">
              <Seg value={s.essencial} total={s.gastos} color={LEVEL.essencial.color} />
              <Seg value={s.util} total={s.gastos} color={LEVEL.util.color} />
              <Seg value={s.besteira} total={s.gastos} color={LEVEL.superfluo.color} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <Legend color={LEVEL.essencial.color} label="Essencial" value={s.essencial} />
              <Legend color={LEVEL.util.color} label="Útil" value={s.util} />
              <Legend color={LEVEL.superfluo.color} label="Besteira" value={s.besteira} />
            </div>
          </div>

          {/* Por categoria */}
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold mb-4">Por categoria</h2>
            <div className="space-y-3">
              {s.categorias.map(([cat, val]) => {
                const pct = s.gastos > 0 ? (val / s.gastos) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#b0b0d0]">{cat}</span>
                      <span className="text-white font-medium">{fmt(val)} <span className="text-[#505070]">· {pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#0d0d1a] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#4d8dff] to-[#9966ff]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Assinaturas / recorrentes */}
          {assinaturas.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#fbbf24]" /> Cobranças que repetem todo mês
              </h2>
              <p className="text-xs text-[#7070a0] mb-4">Total {fmt(s.assinaturas)} — o que mais vaza sem perceber.</p>
              <div className="divide-y divide-[#1a1a2e]">
                {assinaturas.map((t, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-[#b0b0d0] truncate">{t.description}</span>
                    <span className="text-white font-medium shrink-0 ml-3">{fmt(Math.abs(t.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {/* Parcelas ativas */}
          {parcelas.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#4d8dff]" /> Parcelas ativas
              </h2>
              <div className="divide-y divide-[#1a1a2e]">
                {parcelas.map((p) => (
                  <div key={p.id} className="flex justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-[#b0b0d0] truncate">{p.description}</p>
                      <p className="text-xs text-[#505070]">{p.paid}/{p.totalInstallments} pagas · faltam {p.remaining}x ({fmt(p.remaining * p.valuePerInstallment)})</p>
                    </div>
                    <span className="text-white font-medium shrink-0 ml-3">{fmt(p.valuePerInstallment)}/mês</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Seg({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  if (pct <= 0) return null
  return <div style={{ width: `${pct}%`, background: color }} />
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[#7070a0]">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label} <span className="text-white font-medium">{fmt(value)}</span>
    </span>
  )
}
