'use client'
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS, MONTH_LABELS } from '@/lib/types'
import { useData, getCurrentMonth } from '@/lib/store'
import { monthsWithData } from '@/lib/finance-summary'

export default function MonthSelector() {
  const { data, currentMonth, setCurrentMonth } = useData()

  // Navega entre meses com movimento + o mês do calendário (sempre acessível,
  // mesmo vazio — é onde você lança e importa o mês corrente) + o selecionado.
  const meses = useMemo(() => {
    const com = new Set(monthsWithData(data))
    com.add(getCurrentMonth())
    com.add(currentMonth)
    return MONTHS.filter((k) => com.has(k))
  }, [data, currentMonth])

  const idx = meses.indexOf(currentMonth)
  const prev = () => { if (idx > 0) setCurrentMonth(meses[idx - 1]) }
  const next = () => { if (idx < meses.length - 1) setCurrentMonth(meses[idx + 1]) }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={prev}
        disabled={idx <= 0}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="min-w-[92px] md:min-w-[120px] text-center">
        <span className="text-white font-semibold text-sm md:text-base">{MONTH_LABELS[currentMonth]}</span>
      </div>
      <button
        onClick={next}
        disabled={idx === -1 || idx === meses.length - 1}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
