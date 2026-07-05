'use client'
import { useMemo } from 'react'
import { CreditCard, Repeat } from 'lucide-react'
import EmptyCTA from '@/components/EmptyCTA'
import ImportsManager from '@/components/ImportsManager'
import MonthSelector from '@/components/MonthSelector'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { computeSummary } from '@/lib/finance-summary'
import { LEVEL_META as LEVEL } from '@/lib/types'

export default function GastosPage() {
  const { data, setData, currentMonth } = useData()

  // Meta por categoria: prompt simples (valor vazio remove a meta).
  const definirMeta = (cat: string) => {
    const atual = data?.metas?.[cat]
    const v = prompt(`Teto mensal pra ${cat} (R$). Vazio remove a meta.`, atual ? String(atual) : '')
    if (v === null) return
    const num = parseFloat(v.replace(',', '.'))
    setData((prev) => {
      const metas = { ...(prev.metas ?? {}) }
      if (!v.trim() || isNaN(num) || num <= 0) delete metas[cat]
      else metas[cat] = num
      return { ...prev, metas }
    })
  }

  // Ajuste manual do contador de parcelas (a IA marca sozinha ao importar o
  // extrato; isto é a rede de segurança se ela errar ou você pagar por fora).
  const ajustarParcela = (id: string, delta: number) =>
    setData((prev) => ({
      ...prev,
      installments: (prev.installments ?? []).map((p) => {
        if (p.id !== id) return p
        const paid = Math.max(0, Math.min(p.paid + delta, p.totalInstallments))
        const remaining = p.totalInstallments - paid
        return { ...p, paid, remaining, status: remaining <= 0 ? 'QUITADO' as const : 'ATIVO' as const }
      }),
    }))
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

          {/* Por categoria (com meta opcional: toque no alvo pra definir teto) */}
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold mb-1">Por categoria</h2>
            <p className="text-xs text-[#505070] mb-4">Toque no 🎯 pra definir um teto mensal — a barra fica vermelha se estourar.</p>
            <div className="space-y-3">
              {s.categorias.map(([cat, val]) => {
                const meta = data?.metas?.[cat]
                const estourou = !!meta && val > meta
                // Com meta: barra mede o consumo do teto; sem meta: fatia do total.
                const pct = meta ? Math.min(100, (val / meta) * 100) : s.gastos > 0 ? (val / s.gastos) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1 gap-2">
                      <span className="text-[#b0b0d0] flex items-center gap-1.5">
                        {cat}
                        <button onClick={() => definirMeta(cat)} title={meta ? `Meta: ${fmt(meta)}` : 'Definir meta'} className="opacity-60 hover:opacity-100 text-xs">🎯</button>
                      </span>
                      <span className={`font-medium ${estourou ? 'text-[#f87171]' : 'text-white'}`}>
                        {fmt(val)}
                        {meta
                          ? <span className={estourou ? 'text-[#f87171]' : 'text-[#505070]'}> / {fmt(meta)}{estourou ? ' ⚠️' : ''}</span>
                          : <span className="text-[#505070]"> · {pct.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#0d0d1a] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: estourou ? '#f87171' : 'linear-gradient(to right, #4d8dff, #9966ff)' }}
                      />
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

          {/* Extratos e faturas do mês (edita item a item aqui) */}
          <ImportsManager period={currentMonth} />

          {/* Parcelas ativas */}
          {parcelas.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#4d8dff]" /> Parcelas ativas
              </h2>
              <div className="divide-y divide-[#1a1a2e]">
                {parcelas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[#b0b0d0] truncate">{p.description}</p>
                      <p className="text-xs text-[#505070]">{p.paid}/{p.totalInstallments} pagas · faltam {p.remaining}x ({fmt(p.remaining * p.valuePerInstallment)})</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => ajustarParcela(p.id, -1)} title="Desmarcar 1 paga" className="w-6 h-6 rounded-lg bg-[#0d0d1a] border border-[#1a1a2e] text-[#7070a0] hover:text-white text-xs leading-none">−</button>
                      <button onClick={() => ajustarParcela(p.id, +1)} title="Marcar 1 paga" className="w-6 h-6 rounded-lg bg-[#0d0d1a] border border-[#1a1a2e] text-[#7070a0] hover:text-white text-xs leading-none">+</button>
                    </div>
                    <span className="text-white font-medium shrink-0">{fmt(p.valuePerInstallment)}/mês</span>
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
