'use client'
import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, PiggyBank, Flame, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import KPICard from '@/components/KPICard'
import EmptyCTA from '@/components/EmptyCTA'
import MonthSelector from '@/components/MonthSelector'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useData } from '@/lib/store'
import { fmt, fmtShort } from '@/lib/format'
import { computeSummary, previousPeriod, periodsWithData } from '@/lib/finance-summary'
import { estimatedLeak } from '@/lib/leaks'
import { periodLabel } from '@/lib/types'
import { buildAIContext } from '@/lib/ai-context'
import { authHeaders } from '@/lib/api'

export default function ResumoPage() {
  const { data, setData, currentMonth } = useData()
  const s = useMemo(() => computeSummary(data, currentMonth), [data?.imports, data?.holerites, data?.transactions, currentMonth])

  // Mês anterior — pro "+X% vs Junho" e pro veredito comparar.
  const sAnterior = useMemo(
    () => computeSummary(data, previousPeriod(currentMonth)),
    [data?.imports, data?.holerites, data?.transactions, currentMonth],
  )
  const variacaoGastos = s && sAnterior && sAnterior.gastos > 0
    ? ((s.gastos - sAnterior.gastos) / sAnterior.gastos) * 100
    : null

  // Caça-vazamento — determinístico (lib/leaks). O número R$ que dói.
  const vaza = useMemo(
    () => (currentMonth ? estimatedLeak(data, currentMonth) : null),
    [data?.imports, data?.holerites, data?.transactions, currentMonth],
  )

  // Metas estouradas no período (alerta no topo).
  const metasEstouradas = useMemo(() => {
    if (!s || !data?.metas) return []
    return s.categorias
      .filter(([cat, val]) => data.metas![cat] && val > data.metas![cat])
      .map(([cat, val]) => ({ cat, val, meta: data.metas![cat] }))
  }, [s, data?.metas])

  // Últimos 3 períodos com dados → gráfico de barras renda vs gastos.
  const chart = useMemo(() => {
    return periodsWithData(data)
      .slice(-3)
      .map((p) => {
        const ps = computeSummary(data, p)
        return { name: periodLabel(p).replace(' 20', '/'), Renda: ps?.renda ?? 0, Gastos: ps?.gastos ?? 0 }
      })
  }, [data?.imports, data?.holerites, data?.transactions])
  const [gerando, setGerando] = useState(false)
  const [erroVeredito, setErroVeredito] = useState<string | null>(null)

  // Veredito cacheado só vale pro mês selecionado.
  const veredito = data?.veredito?.monthKey === currentMonth ? data.veredito : null

  const gerarVeredito = async () => {
    if (!s) return
    setGerando(true)
    setErroVeredito(null)
    try {
      const vereditosFaturas = (data?.imports ?? []).map((g) => g.verdict).filter((v): v is string => !!v)
      const res = await fetch('/api/veredito', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          resumo: {
            mes: currentMonth,
            renda: s.renda, rendaFixa: s.rendaFixa, rendaVariavel: s.rendaVariavel,
            gastos: s.gastos, sobrou: s.sobrou,
            essencial: s.essencial, util: s.util, besteira: s.besteira,
            assinaturas: s.assinaturas, categorias: s.categorias,
            parcelas: (data?.installments ?? []).filter((p) => p.status === 'ATIVO').map((p) => `${p.description}: R$ ${p.valuePerInstallment}/mês, faltam ${p.remaining}x`),
            mesAnterior: sAnterior
              ? { renda: sAnterior.renda, gastos: sAnterior.gastos, sobrou: sAnterior.sobrou, besteira: sAnterior.besteira }
              : null,
            metas: data?.metas ?? {},
          },
          vereditosFaturas,
          context: buildAIContext(data),
        }),
      })
      const payload = await res.json()
      if (!res.ok) { setErroVeredito(payload.error ?? 'Erro ao gerar o veredito.'); return }
      setData((prev) => ({
        ...prev,
        veredito: { monthKey: currentMonth, verdict: payload.verdict, acoes: payload.acoes ?? [], geradoEm: new Date().toISOString() },
      }))
    } catch {
      setErroVeredito('Falha de conexão.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Resumo</h1>
          <p className="text-[#7070a0] text-sm">Sua situação em um olhada.</p>
        </div>
        <MonthSelector />
      </div>

      {!s ? (
        <EmptyCTA
          title="Ainda não analisei nenhum extrato"
          text="Suba o extrato do banco que eu monto seu resumo — onde gasta, quanto sobra e o que cortar."
        />
      ) : (
        <>
          {/* Veredito — o payoff */}
          <Verdict sobrou={s.sobrou} besteira={s.besteira} maiorFuga={s.maiorFuga} />

          {/* Metas estouradas */}
          {metasEstouradas.length > 0 && (
            <div className="mt-3 bg-[#f87171]/8 border border-[#f87171]/30 rounded-2xl px-4 py-3 text-sm">
              {metasEstouradas.map(({ cat, val, meta }) => (
                <p key={cat} className="text-[#f87171]">
                  ⚠️ <span className="font-medium">{cat}</span> estourou a meta: {fmt(val)} de {fmt(meta)} (+{fmt(val - meta)})
                </p>
              ))}
            </div>
          )}

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

          {/* Comparativo com o mês anterior + evolução */}
          {chart.length >= 2 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-4 md:p-5 mt-6">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold">Comparado ao mês anterior</h2>
                {variacaoGastos !== null && (
                  <span className={`text-sm font-semibold ${variacaoGastos > 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                    Gastos {variacaoGastos > 0 ? '+' : ''}{variacaoGastos.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="h-44 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
                    <XAxis dataKey="name" stroke="#505070" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#505070" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtShort(v)} width={54} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 12, fontSize: 12 }}
                      formatter={(v) => fmt(Number(v))}
                    />
                    <Bar dataKey="Renda" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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

          {/* Caça-vazamento — o número que dói (determinístico) */}
          {vaza && vaza.total > 0 && (
            <div className="bg-[#f87171]/6 border border-[#f87171]/25 rounded-2xl p-5 mt-6">
              <h2 className="text-sm font-semibold mb-1 text-[#f87171]">💸 Onde vaza dinheiro</h2>
              <p className="text-2xl font-bold text-white">{fmt(vaza.total)}<span className="text-sm font-normal text-[#7070a0]"> em desperdício matável</span></p>
              <div className="mt-4 space-y-2 text-sm">
                {vaza.assinaturas.total > 0 && (
                  <p className="text-[#b0b0d0]">📌 <span className="text-white font-medium">{fmt(vaza.assinaturas.total)}</span> em assinaturas ({vaza.assinaturas.items.length}) — {vaza.assinaturas.items.slice(0, 4).map((t) => t.description).join(', ')}{vaza.assinaturas.items.length > 4 ? '…' : ''}</p>
                )}
                {vaza.besteira > 0 && (
                  <p className="text-[#b0b0d0]">🔥 <span className="text-white font-medium">{fmt(vaza.besteira)}</span> em besteira (gasto supérfluo)</p>
                )}
                {vaza.duplicadas.total > 0 && (
                  <p className="text-[#f87171]">⚠️ <span className="font-medium">{fmt(vaza.duplicadas.total)}</span> em cobranças duplicadas: {vaza.duplicadas.groups.slice(0, 3).map((g) => g.description).join(', ')}</p>
                )}
                {vaza.creep.slice(0, 3).map((c) => (
                  <p key={c.category} className="text-[#fbbf24]">📈 <span className="font-medium">{c.category}</span> subiu {(c.deltaPct * 100).toFixed(0)}% vs mês passado ({fmt(c.anterior)} → {fmt(c.atual)})</p>
                ))}
              </div>
            </div>
          )}

          {/* Veredito global do mês (IA, on-demand, cacheado) */}
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#4d8dff]" />
              <h2 className="text-sm font-semibold">Veredito do mês</h2>
              {veredito && (
                <button onClick={gerarVeredito} disabled={gerando} className="ml-auto text-xs text-[#7070a0] hover:text-white flex items-center gap-1 disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${gerando ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              )}
            </div>
            {veredito ? (
              <>
                <p className="text-sm text-[#b0b0d0] mt-2">{veredito.verdict}</p>
                {veredito.acoes.length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {veredito.acoes.map((a, i) => (
                      <li key={i} className="text-sm text-white flex gap-2">
                        <span className="text-[#4d8dff] font-semibold shrink-0">{i + 1}.</span>{a}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <div className="mt-2">
                <p className="text-xs text-[#7070a0] mb-3">A IA olha o mês inteiro (renda, gastos, faturas, parcelas) e te diz o que fazer.</p>
                <button
                  onClick={gerarVeredito}
                  disabled={gerando}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4d8dff] text-white text-sm font-medium hover:bg-[#3d7dee] transition-colors disabled:opacity-60"
                >
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {gerando ? 'Analisando o mês...' : 'Gerar veredito do mês'}
                </button>
              </div>
            )}
            {erroVeredito && <p className="text-xs text-[#f87171] mt-2">{erroVeredito}</p>}
          </div>
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
