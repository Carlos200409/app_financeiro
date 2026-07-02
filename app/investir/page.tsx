'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { PiggyBank, Target, Shield, ArrowRight, Sparkles } from 'lucide-react'
import MonthSelector from '@/components/MonthSelector'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { computeSummary } from '@/lib/finance-summary'

export default function InvestirPage() {
  const { data, currentMonth } = useData()
  const s = useMemo(() => computeSummary(data, currentMonth), [data?.analyzed, data?.holerites, data?.transactions, currentMonth])

  const investido = useMemo(
    () => (data?.investments ?? []).reduce((a, i) => a + i.value, 0),
    [data?.investments],
  )

  // Reserva de emergência: referência clássica de 6 meses de gastos.
  const metaReserva = s ? s.gastos * 6 : 0
  const progresso = metaReserva > 0 ? Math.min(100, (investido / metaReserva) * 100) : 0
  // Sugestão de guardar metade do que sobrou (hábito, não recomendação de ativo).
  const sugestaoGuardar = s && s.sobrou > 0 ? s.sobrou * 0.5 : 0

  if (!s) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold mb-1">Investir</h1>
        <p className="text-[#7070a0] text-sm mb-6">Quanto sobra e o que fazer com isso.</p>
        <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-8 text-center">
          <Sparkles className="w-8 h-8 text-[#4d8dff] mx-auto mb-3" />
          <p className="font-medium">Ainda não sei quanto sobra</p>
          <p className="text-[#7070a0] text-sm mt-1 mb-4">Sobe um holerite e um extrato que eu calculo sua sobra e a meta de reserva.</p>
          <Link href="/analise" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4d8dff] text-white text-sm font-medium hover:bg-[#3d7dee] transition-colors">
            Começar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Investir</h1>
          <p className="text-[#7070a0] text-sm">Quanto sobra e o que fazer com isso.</p>
        </div>
        <MonthSelector />
      </div>

      {/* Sobrou / sugestão */}
      <div className="rounded-2xl p-5 border mb-6" style={{ background: s.sobrou >= 0 ? 'rgba(0,229,170,0.06)' : 'rgba(255,51,102,0.06)', borderColor: s.sobrou >= 0 ? 'rgba(0,229,170,0.25)' : 'rgba(255,51,102,0.25)' }}>
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="w-5 h-5" style={{ color: s.sobrou >= 0 ? '#00e5aa' : '#ff3366' }} />
          <span className="text-sm text-[#b0b0d0]">Sobrou no período</span>
        </div>
        <p className="text-2xl font-bold" style={{ color: s.sobrou >= 0 ? '#00e5aa' : '#ff3366' }}>{fmt(s.sobrou)}</p>
        {sugestaoGuardar > 0 && (
          <p className="text-sm text-[#b0b0d0] mt-2">
            Hábito simples: guarde metade — <span className="text-white font-medium">{fmt(sugestaoGuardar)}</span> — e deixa o resto pra viver.
          </p>
        )}
      </div>

      {/* Meta de reserva */}
      <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#4d8dff]" /> Reserva de emergência
        </h2>
        <p className="text-xs text-[#7070a0] mb-4">
          Referência: 6 meses de gastos ({fmt(s.gastos)}/mês) = <span className="text-white">{fmt(metaReserva)}</span>. Isso vem antes de qualquer investimento.
        </p>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[#b0b0d0]">Você já tem {fmt(investido)}</span>
          <span className="text-[#7070a0]">{progresso.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#0d0d1a] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#00e5aa] to-[#4d8dff]" style={{ width: `${progresso}%` }} />
        </div>
        {investido < metaReserva && (
          <p className="text-xs text-[#7070a0] mt-3">
            <Target className="w-3 h-3 inline mr-1" /> Falta {fmt(metaReserva - investido)} pra fechar a reserva.
          </p>
        )}
      </div>

      {/* Onde já está guardado */}
      {(data?.investments ?? []).length > 0 && (
        <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-4">Onde você já guarda</h2>
          <div className="divide-y divide-[#1a1a2e]">
            {data!.investments.map((i) => (
              <div key={i.id} className="flex justify-between py-2 text-sm">
                <span className="text-[#b0b0d0]">{i.category}</span>
                <span className="text-white font-medium">{fmt(i.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[#505070]">
        Isso é organização das suas finanças, não recomendação de investimento. Pra escolher onde aplicar, fale com um profissional.
      </p>
    </div>
  )
}
