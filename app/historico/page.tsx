'use client'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell
} from 'recharts'
import { useData } from '@/lib/store'
import { fmt, fmtShort } from '@/lib/format'
import { MONTH_LABELS, MonthKey } from '@/lib/types'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-xl p-3 shadow-xl text-xs">
      <p className="text-[#7070a0] mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-medium mt-0.5" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function HistoricoPage() {
  const { data } = useData()

  const chartData = useMemo(
    () => data?.monthlySummaries.map(s => ({
      name: s.month,
      Receita: s.receita,
      Fixos: s.fixos,
      Extras: s.extras,
      Investimentos: s.investimentos,
      Gastos: s.fixos + s.extras,
      Saldo: s.saldo,
    })) ?? [],
    [data]
  )

  const annualTotals = useMemo(() => {
    if (!data) return null
    const summaries = data.monthlySummaries
    return {
      receita: summaries.reduce((s, m) => s + m.receita, 0),
      fixos: summaries.reduce((s, m) => s + m.fixos, 0),
      extras: summaries.reduce((s, m) => s + m.extras, 0),
      investimentos: summaries.reduce((s, m) => s + m.investimentos, 0),
      saldo: summaries.reduce((s, m) => s + m.saldo, 0),
    }
  }, [data])

  if (!data || !annualTotals) return null

  const tableRows = data.monthlySummaries.filter(s =>
    s.receita > 0 || s.fixos > 0 || s.extras > 0 || s.investimentos > 0
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Histórico Anual</h1>
        <p className="text-[#7070a0] text-sm">Resumo do ano completo</p>
      </div>

      {/* Annual totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Receita total', value: annualTotals.receita, color: '#00e5aa' },
          { label: 'Fixos total', value: annualTotals.fixos, color: '#4d8dff' },
          { label: 'Extras total', value: annualTotals.extras, color: '#ffcc00' },
          { label: 'Investimentos', value: annualTotals.investimentos, color: '#9966ff' },
          { label: 'Saldo anual', value: annualTotals.saldo, color: annualTotals.saldo >= 0 ? '#00e5aa' : '#ff3366' },
        ].map(item => (
          <div key={item.label} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl p-3 text-center">
            <p className="text-[#7070a0] text-xs mb-1">{item.label}</p>
            <p className="font-bold text-sm" style={{ color: item.color }}>{fmtShort(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 mb-4">
        <div className="mb-4">
          <h3 className="text-white font-semibold text-sm">Gastos por categoria</h3>
          <p className="text-[#7070a0] text-xs">Fixos + Extras + Investimentos por mês</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barSize={12}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={6} formatter={(val) => <span style={{ color: '#8080a0', fontSize: 11 }}>{val}</span>} />
            <Bar dataKey="Fixos" stackId="a" fill="#4d8dff" fillOpacity={0.85} radius={[0,0,0,0]} />
            <Bar dataKey="Extras" stackId="a" fill="#ffcc00" fillOpacity={0.85} />
            <Bar dataKey="Investimentos" stackId="a" fill="#9966ff" fillOpacity={0.85} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart - receita vs saldo */}
      <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 mb-4">
        <div className="mb-4">
          <h3 className="text-white font-semibold text-sm">Receita e Saldo</h3>
          <p className="text-[#7070a0] text-xs">Evolução ao longo do ano</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={fmtShort} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={6} formatter={(val) => <span style={{ color: '#8080a0', fontSize: 11 }}>{val}</span>} />
            <Line type="monotone" dataKey="Receita" stroke="#00e5aa" strokeWidth={2} dot={{ fill: '#00e5aa', r: 3 }} />
            <Line type="monotone" dataKey="Saldo" stroke="#4d8dff" strokeWidth={2} dot={{ fill: '#4d8dff', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      {tableRows.length > 0 && (
        <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#1a1a2e]">
            <h3 className="text-white font-semibold text-sm">Tabela mensal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  {['Mês', 'Receita', 'Fixos', 'Extras', 'Invest.', 'Saldo'].map(h => (
                    <th key={h} className="text-left text-[#7070a0] text-xs font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(s => (
                  <tr key={s.month} className="border-b border-[#1a1a2e] last:border-0 hover:bg-[#141424] transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{MONTH_LABELS[s.month as MonthKey].slice(0, 3)}</td>
                    <td className="px-4 py-3 text-[#00e5aa]">{s.receita > 0 ? fmt(s.receita) : '—'}</td>
                    <td className="px-4 py-3 text-[#4d8dff]">{s.fixos > 0 ? fmt(s.fixos) : '—'}</td>
                    <td className="px-4 py-3 text-[#ffcc00]">{s.extras > 0 ? fmt(s.extras) : '—'}</td>
                    <td className="px-4 py-3 text-[#9966ff]">{s.investimentos > 0 ? fmt(s.investimentos) : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${s.saldo >= 0 ? 'text-[#00e5aa]' : 'text-[#ff3366]'}`}>
                      {fmt(s.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#141424]">
                  <td className="px-4 py-3 text-white font-bold text-xs">TOTAL</td>
                  <td className="px-4 py-3 text-[#00e5aa] font-bold text-xs">{fmt(annualTotals.receita)}</td>
                  <td className="px-4 py-3 text-[#4d8dff] font-bold text-xs">{fmt(annualTotals.fixos)}</td>
                  <td className="px-4 py-3 text-[#ffcc00] font-bold text-xs">{fmt(annualTotals.extras)}</td>
                  <td className="px-4 py-3 text-[#9966ff] font-bold text-xs">{fmt(annualTotals.investimentos)}</td>
                  <td className={`px-4 py-3 font-bold text-xs ${annualTotals.saldo >= 0 ? 'text-[#00e5aa]' : 'text-[#ff3366]'}`}>
                    {fmt(annualTotals.saldo)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
