'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthKey, MONTHS, MONTH_LABELS } from '@/lib/types'
import { useData } from '@/lib/store'

export default function MonthSelector() {
  const { currentMonth, setCurrentMonth } = useData()
  const idx = MONTHS.indexOf(currentMonth)

  const prev = () => { if (idx > 0) setCurrentMonth(MONTHS[idx - 1]) }
  const next = () => { if (idx < MONTHS.length - 1) setCurrentMonth(MONTHS[idx + 1]) }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        disabled={idx === 0}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="min-w-[120px] text-center">
        <span className="text-white font-semibold">{MONTH_LABELS[currentMonth]}</span>
      </div>
      <button
        onClick={next}
        disabled={idx === MONTHS.length - 1}
        className="w-8 h-8 rounded-lg bg-[#141424] border border-[#1a1a2e] flex items-center justify-center text-[#7070a0] hover:text-white hover:border-[#2a2a44] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
