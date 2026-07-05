'use client'
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { periodLabel } from '@/lib/types'
import { useData, getCurrentMonth } from '@/lib/store'
import { periodsWithData } from '@/lib/finance-summary'

export default function MonthSelector() {
  const { data, currentMonth, setCurrentMonth } = useData()

  // Navega entre períodos (YYYY-MM) com movimento + o mês do calendário
  // (sempre acessível, mesmo vazio) + o selecionado.
  const periodos = useMemo(() => {
    const set = new Set(periodsWithData(data))
    set.add(getCurrentMonth())
    set.add(currentMonth)
    return [...set].sort()
  }, [data, currentMonth])

  const idx = periodos.indexOf(currentMonth)
  const prev = () => { if (idx > 0) setCurrentMonth(periodos[idx - 1]) }
  const next = () => { if (idx < periodos.length - 1) setCurrentMonth(periodos[idx + 1]) }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={prev}
        disabled={idx <= 0}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="min-w-[104px] md:min-w-[132px] text-center">
        <span className="text-white font-semibold text-sm md:text-base">{periodLabel(currentMonth)}</span>
      </div>
      <button
        onClick={next}
        disabled={idx === -1 || idx === periodos.length - 1}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
