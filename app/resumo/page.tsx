'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, PiggyBank, Flame, Sparkles, ArrowRight } from 'lucide-react'
import KPICard from '@/components/KPICard'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { AnalyzedTransaction } from '@/lib/types'

export default function ResumoPage() {
  const { data } = useData()

  const s = useMemo(() => {
    const analyzed = data?.analyzed ?? []
    const holerites = data?.holerites ?? []
    if (analyzed.length === 0 && holerites.length === 0) return null

    const entradas = analyzed.filter((t) => t.amount > 0)
    const saidas = analyzed.filter((t) => t.amount < 0)

    const holeriteLiquido = holerites.reduce((a, h) => a + (h.liquido || 0), 0)
    const rendaFixaExtrato = entradas.filter((t) => t.recurring).reduce((a, t) => a + t.amount, 0)
    // Holerite é a fonte autoritativa da renda fixa; havendo holerite, usa ele
    // pra não contar o salário duas vezes (holerite + depósito no extrato).
    const rendaFixa = holerites.length > 0 ? holeriteLiquido : rendaFixaExtrato
    const rendaVariavel = entradas.filter((t) => !t.recurring).reduce((a, t) => a + t.amount, 0)
    const renda = rendaFixa + rendaVariavel

    const gastos = saidas.reduce((a, t) => a + Math.abs(t.amount), 0)
    const sobrou = renda - gastos
    const besteira = saidas.filter((t) => t.level === 'superfluo').reduce((a, t) => a + Math.abs(t.amount), 0)

    // Gasto por categoria → maior fuga
    const porCategoria = new Map<string, number>()
    for (const t of saidas) porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + Math.abs(t.amount))
    const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])
    const maiorFuga = categorias[0]

    // Assinaturas recorrentes (gasto que repete)
    const assinaturas = saidas.filter((t) => t.recurring).reduce((a, t) => a + Math.abs(t.amount), 0)

    const datas = analyzed.map((t) => t.date).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
    const periodo = datas.length ? `${br(datas[0])} – ${br(datas[datas.length - 1])}` : null

    return { renda, rendaFixa, rendaVariavel, gastos, sobrou, besteira, assinaturas, categorias, maiorFuga, periodo, total: analyzed.length }
  }, [data?.analyzed, data?.holerites])

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Resumo</h1>
      <p className="text-[#7070a0] text-sm mb-6">
        Sua situação em um olhada{s?.periodo ? ` · ${s.periodo}` : ''}.
      </p>

      {!s ? (
        <EmptyState />
      ) : (
        <>
          {/* Veredito — o payoff */}
          <Verdict sobrou={s.sobrou} besteira={s.besteira} maiorFuga={s.maiorFuga} />

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KPICard
              title="Renda"
              value={s.renda}
              icon={TrendingUp}
              color="green"
              subtitle={`Fixo ${fmt(s.rendaFixa)} · Variável ${fmt(s.rendaVariavel)}`}
            />
            <KPICard title="Gastos" value={s.gastos} icon={TrendingDown} color="red" />
            <KPICard
              title="Sobrou"
              value={s.sobrou}
              icon={PiggyBank}
              color={s.sobrou >= 0 ? 'blue' : 'red'}
            />
            <KPICard
              title="Besteira"
              value={s.besteira}
              icon={Flame}
              color="yellow"
              subtitle="gasto supérfluo"
            />
          </div>

          {/* Onde vai o dinheiro */}
          {s.categorias.length > 0 && (
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mt-6">
            <h2 className="text-sm font-semibold mb-4">Onde vai o dinheiro</h2>
            <div className="space-y-3">
              {s.categorias.slice(0, 6).map(([cat, val]) => {
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
            {s.assinaturas > 0 && (
              <p className="text-xs text-[#7070a0] mt-4">
                📌 {fmt(s.assinaturas)} são cobranças recorrentes (assinaturas/mensalidades) — vale revisar.
              </p>
            )}
          </div>
          )}

          {/* Insights da IA */}
          {data?.insights && data.insights.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mt-6">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4d8dff]" /> Onde dá pra sobrar
              </h2>
              <ul className="space-y-2">
                {data.insights.map((it, i) => (
                  <li key={i} className="text-sm text-[#b0b0d0] flex gap-2">
                    <span className="text-[#4d8dff]">•</span>{it}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Verdict({ sobrou, besteira, maiorFuga }: { sobrou: number; besteira: number; maiorFuga?: [string, number] }) {
  const verde = sobrou >= 0
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: verde ? 'rgba(0,229,170,0.06)' : 'rgba(255,51,102,0.06)',
        borderColor: verde ? 'rgba(0,229,170,0.25)' : 'rgba(255,51,102,0.25)',
      }}
    >
      <p className="text-lg font-semibold" style={{ color: verde ? '#00e5aa' : '#ff3366' }}>
        {verde ? `Fechou no verde: sobrou ${fmt(sobrou)}` : `Fechou no vermelho: faltou ${fmt(Math.abs(sobrou))}`}
      </p>
      <div className="mt-2 space-y-1 text-sm text-[#b0b0d0]">
        {maiorFuga && (
          <p>Sua maior saída foi <span className="text-white font-medium">{maiorFuga[0]}</span> ({fmt(maiorFuga[1])}).</p>
        )}
        {besteira > 0 && (
          <p>Cortando as besteiras, sobraria <span className="text-white font-medium">+{fmt(besteira)}</span>{verde ? '' : ' — quase fechando a conta'}.</p>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-8 text-center">
      <Sparkles className="w-8 h-8 text-[#4d8dff] mx-auto mb-3" />
      <p className="font-medium">Ainda não analisei nenhum extrato</p>
      <p className="text-[#7070a0] text-sm mt-1 mb-4">
        Suba o extrato do banco que eu monto seu resumo — onde gasta, quanto sobra e o que cortar.
      </p>
      <Link
        href="/analise"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4d8dff] text-white text-sm font-medium hover:bg-[#3d7dee] transition-colors"
      >
        Analisar extrato <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// "2026-03-27" → "27/03"
function br(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
