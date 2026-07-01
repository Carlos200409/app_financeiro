'use client'
import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Download, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import KPICard from '@/components/KPICard'
import MonthSelector from '@/components/MonthSelector'
import DonutChart from '@/components/DonutChart'
import { useData, clearData } from '@/lib/store'
import { fmt, fmtShort } from '@/lib/format'
import { exportToXLSX } from '@/lib/xlsx-parser'
import { MONTH_LABELS, MonthKey } from '@/lib/types'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-xl p-3 shadow-xl text-xs">
      <p className="text-[#7070a0] mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data, currentMonth } = useData()

  const monthSummary = useMemo(
    () => data?.monthlySummaries.find(s => s.month === currentMonth),
    [data, currentMonth]
  )

  const totalParcelas = useMemo(
    () => data?.installments.filter(i => i.status === 'ATIVO').reduce((s, i) => s + i.valuePerInstallment, 0) ?? 0,
    [data]
  )

  const chartData = useMemo(
    () => data?.monthlySummaries.map(s => ({
      name: s.month,
      Receita: s.receita,
      Gastos: s.fixos + s.extras + totalParcelas,
      Saldo: s.saldo - totalParcelas,
    })) ?? [],
    [data, totalParcelas]
  )

  const donutSlices = useMemo(() => {
    if (!monthSummary) return []
    return [
      { label: 'Fixos',    value: monthSummary.fixos,    color: '#4d8dff' },
      { label: 'Extras',   value: monthSummary.extras,   color: '#ffcc00' },
      { label: 'Parcelas', value: totalParcelas,          color: '#ff9966' },
      { label: 'Invest.',  value: monthSummary.investimentos, color: '#9966ff' },
    ].filter(d => d.value > 0)
  }, [monthSummary, totalParcelas])

  const recentMonths = useMemo(() => {
    if (!data) return []
    const idx = data.monthlySummaries.findIndex(s => s.month === currentMonth)
    return data.monthlySummaries.slice(Math.max(0, idx - 4), idx + 1).reverse()
  }, [data, currentMonth])

  const totalGastos = (monthSummary?.fixos ?? 0) + (monthSummary?.extras ?? 0) + totalParcelas
  const saldoReal   = (monthSummary?.saldo ?? 0) - totalParcelas
  const totalInvestimentos = data?.investments.reduce((s, i) => s + i.value, 0) ?? 0

  const handleReset = () => {
    if (confirm('Remover todos os dados e reimportar planilha?')) {
      clearData()
      window.location.reload()
    }
  }

  if (!data || !monthSummary) return null

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-[#7070a0] text-sm">Visão geral financeira</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector />
          <button
            onClick={() => exportToXLSX(data)}
            className="w-9 h-9 rounded-xl bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-[#4d8dff] hover:border-[#4d8dff]/40 transition-all"
            title="Exportar XLSX"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="w-9 h-9 rounded-xl bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-[#ff3366] hover:border-[#ff3366]/40 transition-all"
            title="Reimportar planilha"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard title="Receita" value={monthSummary.receita} icon={TrendingUp} color="green" subtitle={MONTH_LABELS[currentMonth]} />
        <KPICard
          title="Gastos"
          value={totalGastos}
          icon={TrendingDown}
          color="red"
          subtitle={monthSummary.receita > 0 ? `${((totalGastos / monthSummary.receita) * 100).toFixed(0)}% da receita` : 'do mês'}
        />
        <KPICard
          title="Saldo"
          value={saldoReal}
          icon={Wallet}
          color={saldoReal >= 0 ? 'blue' : 'red'}
          subtitle={saldoReal >= 0 ? 'No positivo 👍' : 'Atenção!'}
        />
        <KPICard title="Patrimônio" value={totalInvestimentos} icon={PiggyBank} color="purple" subtitle="Total investido" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm">Receita vs Gastos</h3>
            <p className="text-[#7070a0] text-xs">Evolução anual</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5aa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00e5aa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-gastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3366" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ff3366" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Receita" stroke="#00e5aa" strokeWidth={2} fill="url(#grad-receita)" dot={false} />
              <Area type="monotone" dataKey="Gastos" stroke="#ff3366" strokeWidth={2} fill="url(#grad-gastos)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5">
          <div className="mb-3">
            <h3 className="text-white font-semibold text-sm">Gastos do mês</h3>
            <p className="text-[#7070a0] text-xs">{MONTH_LABELS[currentMonth]}</p>
          </div>
          {donutSlices.length > 0 ? (
            <div className="flex items-center justify-center">
              <DonutChart
                slices={donutSlices}
                centerLabel="Total gasto"
                centerValue={totalGastos}
                size={200}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#1e1e33]" />
              <p className="text-[#404066] text-sm">Sem gastos registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm">Saldo mensal</h3>
            <p className="text-[#7070a0] text-xs">Resultado por mês</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barSize={14}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Saldo" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.Saldo >= 0 ? '#00e5aa' : '#ff3366'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Últimos meses</h3>
          <div className="flex flex-col gap-1">
            {recentMonths.map(m => (
              <div key={m.month} className="flex items-center justify-between py-2.5 border-b border-[#1a1a2e] last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${m.saldo >= 0 ? 'bg-[#00e5aa]' : 'bg-[#ff3366]'}`} />
                  <span className="text-[#a0a0c0] text-sm">{MONTH_LABELS[m.month as MonthKey].slice(0, 3)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {m.saldo >= 0
                    ? <ArrowUpRight className="w-3 h-3 text-[#00e5aa]" />
                    : <ArrowDownRight className="w-3 h-3 text-[#ff3366]" />
                  }
                  <span className={`text-sm font-semibold ${m.saldo >= 0 ? 'text-[#00e5aa]' : 'text-[#ff3366]'}`}>
                    {fmtShort(m.saldo)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
