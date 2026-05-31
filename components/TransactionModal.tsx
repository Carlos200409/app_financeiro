'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { Category, Transaction, MonthKey } from '@/lib/types'

interface Props {
  month: MonthKey
  onSave: (tx: Omit<Transaction, 'id'>) => void
  onClose: () => void
  initial?: Transaction
}

export default function TransactionModal({ month, onSave, onClose, initial }: Props) {
  const [category, setCategory] = useState<Category>(initial?.category ?? 'fixo')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [value, setValue] = useState(initial?.value ? String(initial.value) : '')
  const [date, setDate] = useState(initial?.date ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.'))
    if (!description.trim() || isNaN(v) || v <= 0) return
    onSave({ month, category, description: description.trim(), value: v, date: date || undefined })
    onClose()
  }

  const cats: { value: Category; label: string; color: string }[] = [
    { value: 'receita', label: 'Receita', color: '#00e5aa' },
    { value: 'fixo', label: 'Fixo', color: '#4d8dff' },
    { value: 'extra', label: 'Extra', color: '#ffcc00' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{initial ? 'Editar' : 'Nova'} transação</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#7070a0] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-[#7070a0] text-xs font-medium mb-1.5 block">Categoria</label>
            <div className="flex gap-2">
              {cats.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    category === c.value
                      ? 'border-current'
                      : 'border-[#1a1a2e] text-[#7070a0] hover:border-[#2a2a44]'
                  }`}
                  style={category === c.value ? { color: c.color, borderColor: c.color, backgroundColor: c.color + '15' } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[#7070a0] text-xs font-medium mb-1.5 block">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Supermercado"
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50"
            />
          </div>

          <div>
            <label className="text-[#7070a0] text-xs font-medium mb-1.5 block">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0,00"
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50"
            />
          </div>

          <div>
            <label className="text-[#7070a0] text-xs font-medium mb-1.5 block">Data (opcional)</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#4d8dff]/50"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4d8dff] to-[#9966ff] text-white font-semibold text-sm hover:opacity-90 transition-opacity mt-1"
          >
            {initial ? 'Salvar alterações' : 'Adicionar transação'}
          </button>
        </form>
      </div>
    </div>
  )
}
