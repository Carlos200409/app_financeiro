'use client'
import { useState } from 'react'
import { Plus, Trash2, TrendingUp, X } from 'lucide-react'
import DonutChart from '@/components/DonutChart'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { Investment } from '@/lib/types'

const COLORS = ['#4d8dff', '#9966ff', '#00e5aa', '#ffcc00', '#ff3366', '#ff9966']

function InvestmentModal({ onSave, onClose, initial }: {
  onSave: (i: Omit<Investment, 'id'>) => void
  onClose: () => void
  initial?: Investment
}) {
  const [category, setCategory] = useState(initial?.category ?? '')
  const [value, setValue]       = useState(initial?.value ? String(initial.value) : '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.'))
    if (!category.trim() || isNaN(v) || v < 0) return
    onSave({ category: category.trim(), value: v })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{initial ? 'Editar' : 'Novo'} investimento</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#7070a0] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-[#7070a0] text-xs mb-1.5 block">Categoria</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Renda Fixa / CDB"
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
          </div>
          <div>
            <label className="text-[#7070a0] text-xs mb-1.5 block">Saldo atual (R$)</label>
            <input value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" inputMode="decimal"
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4d8dff] to-[#9966ff] text-white font-semibold text-sm hover:opacity-90 mt-1">
            {initial ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function InvestimentosPage() {
  const { data, setData } = useData()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Investment | null>(null)

  const investments = data?.investments ?? []
  const total       = investments.reduce((s, i) => s + i.value, 0)

  const handleSave = (inv: Omit<Investment, 'id'>) => {
    if (!data) return
    setData({ ...data, investments: [...data.investments, { ...inv, id: `inv_${Date.now()}` }] })
  }

  const handleEdit = (inv: Omit<Investment, 'id'>) => {
    if (!data || !editing) return
    setData({ ...data, investments: data.investments.map(i => i.id === editing.id ? { ...inv, id: editing.id } : i) })
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    if (!data) return
    setData({ ...data, investments: data.investments.filter(i => i.id !== id) })
  }

  if (!data) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Investimentos</h1>
          <p className="text-[#7070a0] text-sm">{investments.length} ativos</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4d8dff] to-[#9966ff] flex items-center justify-center text-white hover:opacity-90 shadow-lg shadow-[#4d8dff]/20">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Patrimônio total */}
      <div className="bg-gradient-to-br from-[#4d8dff]/20 to-[#9966ff]/20 border border-[#4d8dff]/20 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9966ff]/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#9966ff]" />
          </div>
          <div>
            <p className="text-[#7070a0] text-xs">Total patrimônio</p>
            <p className="text-2xl font-bold text-white">{fmt(total)}</p>
          </div>
        </div>
      </div>

      {/* Donut */}
      {investments.filter(i => i.value > 0).length > 0 && (
        <div className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 mb-5">
          <h3 className="text-white font-semibold text-sm mb-3">Alocação</h3>
          <div className="flex justify-center">
            <DonutChart
              slices={investments.filter(i => i.value > 0).map((inv, idx) => ({
                label: inv.category.split('(')[0].trim().split('/')[0].trim().slice(0, 20),
                value: inv.value,
                color: COLORS[idx % COLORS.length],
              }))}
              centerLabel="Patrimônio"
              centerValue={total}
              size={200}
            />
          </div>
        </div>
      )}

      {/* Lista — toque para editar */}
      {investments.length === 0 ? (
        <div className="text-center py-12 text-[#404066]">
          <p className="text-lg mb-1">Nenhum investimento</p>
          <p className="text-sm">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {investments.map((inv, i) => {
            const pct = total > 0 ? (inv.value / total) * 100 : 0
            return (
              <div
                key={inv.id}
                className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl p-4 cursor-pointer hover:bg-[#141424] active:scale-[0.99] transition-all"
                onClick={() => setEditing(inv)}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-white text-sm font-medium truncate">{inv.category}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-white font-semibold text-sm">{fmt(inv.value)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(inv.id) }}
                      className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#404060] hover:text-[#ff3366] hover:bg-[#ff3366]/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-[#7070a0] text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <InvestmentModal onSave={handleSave} onClose={() => setShowModal(false)} />}
      {editing && <InvestmentModal onSave={handleEdit} onClose={() => setEditing(null)} initial={editing} />}
    </div>
  )
}
