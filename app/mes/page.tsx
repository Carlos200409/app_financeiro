'use client'
import { useMemo, useState } from 'react'
import { Plus, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import MonthSelector from '@/components/MonthSelector'
import TransactionModal from '@/components/TransactionModal'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { Transaction, MONTH_LABELS, Category } from '@/lib/types'

const catConfig = {
  receita: { label: 'Receita', color: '#00e5aa', bg: 'bg-[#00e5aa]/10', text: 'text-[#00e5aa]', border: 'border-[#00e5aa]/20' },
  fixo:    { label: 'Fixo',    color: '#4d8dff', bg: 'bg-[#4d8dff]/10', text: 'text-[#4d8dff]', border: 'border-[#4d8dff]/20' },
  extra:   { label: 'Extra',   color: '#ffcc00', bg: 'bg-[#ffcc00]/10', text: 'text-[#ffcc00]', border: 'border-[#ffcc00]/20' },
}

type Filter = 'all' | Category

export default function MesPage() {
  const { data, setData, currentMonth } = useData()
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const transactions = useMemo(
    () => (data?.transactions.filter(t => t.month === currentMonth) ?? [])
      .filter(t => filter === 'all' || t.category === filter),
    [data, currentMonth, filter]
  )

  const summary = useMemo(
    () => data?.monthlySummaries.find(s => s.month === currentMonth),
    [data, currentMonth]
  )

  const handleSave = (tx: Omit<Transaction, 'id'>) => {
    if (!data) return
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newData = {
      ...data,
      transactions: [...data.transactions, { ...tx, id }],
      monthlySummaries: data.monthlySummaries.map(s => {
        if (s.month !== tx.month) return s
        return {
          ...s,
          receita: tx.category === 'receita' ? s.receita + tx.value : s.receita,
          fixos:   tx.category === 'fixo'    ? s.fixos   + tx.value : s.fixos,
          extras:  tx.category === 'extra'   ? s.extras  + tx.value : s.extras,
          saldo:   s.saldo + (tx.category === 'receita' ? tx.value : -tx.value),
        }
      }),
    }
    setData(newData)
  }

  const handleEdit = (tx: Omit<Transaction, 'id'>) => {
    if (!data || !editing) return
    const old = editing
    const newData = {
      ...data,
      transactions: data.transactions.map(t => t.id === old.id ? { ...tx, id: old.id } : t),
      monthlySummaries: data.monthlySummaries.map(s => {
        if (s.month !== old.month && s.month !== tx.month) return s
        let { receita, fixos, extras, saldo } = s
        // revert old
        if (s.month === old.month) {
          if (old.category === 'receita') { receita -= old.value; saldo -= old.value }
          else if (old.category === 'fixo')  { fixos  -= old.value; saldo += old.value }
          else                               { extras -= old.value; saldo += old.value }
        }
        // apply new
        if (s.month === tx.month) {
          if (tx.category === 'receita') { receita += tx.value; saldo += tx.value }
          else if (tx.category === 'fixo')  { fixos  += tx.value; saldo -= tx.value }
          else                              { extras += tx.value; saldo -= tx.value }
        }
        return { ...s, receita, fixos, extras, saldo }
      }),
    }
    setData(newData)
    setEditing(null)
  }

  const handleDelete = (tx: Transaction) => {
    if (!data) return
    const newData = {
      ...data,
      transactions: data.transactions.filter(t => t.id !== tx.id),
      monthlySummaries: data.monthlySummaries.map(s => {
        if (s.month !== tx.month) return s
        return {
          ...s,
          receita: tx.category === 'receita' ? s.receita - tx.value : s.receita,
          fixos:   tx.category === 'fixo'    ? s.fixos   - tx.value : s.fixos,
          extras:  tx.category === 'extra'   ? s.extras  - tx.value : s.extras,
          saldo:   s.saldo + (tx.category === 'receita' ? -tx.value : tx.value),
        }
      }),
    }
    setData(newData)
  }

  if (!data) return null

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all',     label: 'Todos',    count: data.transactions.filter(t => t.month === currentMonth).length },
    { value: 'receita', label: 'Receitas', count: data.transactions.filter(t => t.month === currentMonth && t.category === 'receita').length },
    { value: 'fixo',    label: 'Fixos',    count: data.transactions.filter(t => t.month === currentMonth && t.category === 'fixo').length },
    { value: 'extra',   label: 'Extras',   count: data.transactions.filter(t => t.month === currentMonth && t.category === 'extra').length },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">{MONTH_LABELS[currentMonth]}</h1>
          <p className="text-[#7070a0] text-sm">{filters[0].count} transações</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector />
          <button
            onClick={() => setShowModal(true)}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4d8dff] to-[#9966ff] flex items-center justify-center text-white hover:opacity-90 shadow-lg shadow-[#4d8dff]/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Receita', value: summary.receita, color: '#00e5aa' },
            { label: 'Gastos',  value: summary.fixos + summary.extras, color: '#ff3366' },
            { label: 'Saldo',   value: summary.saldo, color: summary.saldo >= 0 ? '#4d8dff' : '#ff3366' },
          ].map(item => (
            <div key={item.label} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl p-3 text-center">
              <p className="text-[#7070a0] text-xs mb-0.5">{item.label}</p>
              <p className="font-bold text-sm" style={{ color: item.color }}>{fmt(item.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f.value
                ? 'bg-[#4d8dff]/15 text-[#4d8dff] border border-[#4d8dff]/30'
                : 'text-[#7070a0] border border-[#1a1a2e] hover:border-[#2a2a44] hover:text-white'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === f.value ? 'bg-[#4d8dff]/20 text-[#4d8dff]' : 'bg-[#1a1a2e] text-[#505070]'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div className="text-center py-16 text-[#404066]">
          <p className="text-lg mb-1">Nenhuma transação</p>
          <p className="text-sm">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map(tx => {
            const c = catConfig[tx.category]
            return (
              <div
                key={tx.id}
                className={`flex items-center gap-3 bg-[#0d0d1a] border rounded-xl px-3 py-3 transition-all active:scale-[0.99] cursor-pointer ${c.border} hover:bg-[#141424]`}
                onClick={() => setEditing(tx)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                  {tx.category === 'receita'
                    ? <ArrowUpRight className="w-4 h-4" style={{ color: c.color }} />
                    : <ArrowDownLeft className="w-4 h-4" style={{ color: c.color }} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{tx.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[11px] font-medium ${c.text}`}>{c.label}</span>
                    {tx.date && <span className="text-[#404066] text-[11px]">· {tx.date}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-semibold text-sm ${tx.category === 'receita' ? 'text-[#00e5aa]' : 'text-white'}`}>
                    {tx.category === 'receita' ? '+' : '-'}{fmt(tx.value)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(tx) }}
                    className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#404060] hover:text-[#ff3366] hover:bg-[#ff3366]/10 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <TransactionModal month={currentMonth} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
      {editing && (
        <TransactionModal month={editing.month} onSave={handleEdit} onClose={() => setEditing(null)} initial={editing} />
      )}
    </div>
  )
}
