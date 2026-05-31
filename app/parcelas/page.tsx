'use client'
import { useState, useMemo } from 'react'
import { Plus, CheckCircle2, Clock, Trash2, X } from 'lucide-react'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { Installment } from '@/lib/types'

type Filter = 'all' | 'ATIVO' | 'QUITADO'

function InstallmentModal({ onSave, onClose, initial }: {
  onSave: (i: Omit<Installment, 'id'>) => void
  onClose: () => void
  initial?: Installment
}) {
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [parcValue, setParcValue] = useState(initial?.valuePerInstallment ? String(initial.valuePerInstallment) : '')
  const [totalParc, setTotalParc] = useState(initial?.totalInstallments  ? String(initial.totalInstallments)  : '')
  const [paid, setPaid]           = useState(initial?.paid               ? String(initial.paid)               : '')
  const [status, setStatus]       = useState<'ATIVO' | 'QUITADO'>(initial?.status ?? 'ATIVO')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const pv  = parseFloat(parcValue.replace(',', '.')) || 0
    const tot = parseInt(totalParc) || 0
    const p   = parseInt(paid) || 0
    if (!desc.trim()) return
    onSave({
      description:          desc.trim(),
      total:                pv * tot,
      installmentAmount:    pv * p,
      valuePerInstallment:  pv,
      totalInstallments:    tot,
      status,
      paid:                 p,
      remaining:            Math.max(0, tot - p),
      advance:              false,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{initial ? 'Editar' : 'Nova'} parcela</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#7070a0] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="text-[#7070a0] text-xs mb-1.5 block">Descrição</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Notebook Dell (3/12)"
              className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[#7070a0] text-xs mb-1.5 block">Valor/parc. R$</label>
              <input value={parcValue} onChange={e => setParcValue(e.target.value)} placeholder="0,00" inputMode="decimal"
                className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
            </div>
            <div>
              <label className="text-[#7070a0] text-xs mb-1.5 block">Total parc.</label>
              <input value={totalParc} onChange={e => setTotalParc(e.target.value)} placeholder="12" inputMode="numeric"
                className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
            </div>
            <div>
              <label className="text-[#7070a0] text-xs mb-1.5 block">Pagas</label>
              <input value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" inputMode="numeric"
                className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50" />
            </div>
          </div>

          <div>
            <label className="text-[#7070a0] text-xs mb-1.5 block">Status</label>
            <div className="flex gap-2">
              {(['ATIVO', 'QUITADO'] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    status === s
                      ? s === 'ATIVO' ? 'border-[#4d8dff] bg-[#4d8dff]/10 text-[#4d8dff]' : 'border-[#00e5aa] bg-[#00e5aa]/10 text-[#00e5aa]'
                      : 'border-[#1a1a2e] text-[#7070a0]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4d8dff] to-[#9966ff] text-white font-semibold text-sm hover:opacity-90 mt-1">
            {initial ? 'Salvar alterações' : 'Adicionar parcela'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ParcelasPage() {
  const { data, setData }   = useData()
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Installment | null>(null)

  const installments = useMemo(
    () => (data?.installments ?? []).filter(i => filter === 'all' || i.status === filter),
    [data, filter]
  )

  const stats = useMemo(() => {
    const ativos = (data?.installments ?? []).filter(i => i.status === 'ATIVO')
    return {
      total:         ativos.length,
      valorMensal:   ativos.reduce((s, i) => s + i.valuePerInstallment, 0),
      valorRestante: ativos.reduce((s, i) => s + (i.remaining * i.valuePerInstallment), 0),
    }
  }, [data])

  const handleSave = (inst: Omit<Installment, 'id'>) => {
    if (!data) return
    setData({ ...data, installments: [...data.installments, { ...inst, id: `inst_${Date.now()}` }] })
  }

  const handleEdit = (inst: Omit<Installment, 'id'>) => {
    if (!data || !editing) return
    setData({ ...data, installments: data.installments.map(i => i.id === editing.id ? { ...inst, id: editing.id } : i) })
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    if (!data) return
    setData({ ...data, installments: data.installments.filter(i => i.id !== id) })
  }

  if (!data) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Parcelas</h1>
          <p className="text-[#7070a0] text-sm">{data.installments.length} registros</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4d8dff] to-[#9966ff] flex items-center justify-center text-white hover:opacity-90 shadow-lg shadow-[#4d8dff]/20">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Ativas',        value: String(stats.total),           color: '#4d8dff', isNum: true  },
          { label: 'Custo mensal',  value: fmt(stats.valorMensal),        color: '#ff3366', isNum: false },
          { label: 'Total restante',value: fmt(stats.valorRestante),      color: '#9966ff', isNum: false },
        ].map(item => (
          <div key={item.label} className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-xl p-3 text-center">
            <p className="text-[#7070a0] text-xs mb-0.5">{item.label}</p>
            <p className="font-bold text-sm" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {([['all','Todas'], ['ATIVO','Ativas'], ['QUITADO','Quitadas']] as [Filter,string][]).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === v ? 'bg-[#4d8dff]/15 text-[#4d8dff] border border-[#4d8dff]/30' : 'text-[#7070a0] border border-[#1a1a2e] hover:border-[#2a2a44] hover:text-white'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {installments.length === 0 ? (
        <div className="text-center py-16 text-[#404066]">
          <p className="text-lg mb-1">Nenhuma parcela</p>
          <p className="text-sm">Clique no + para adicionar</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {installments.map(inst => {
            const progress = inst.totalInstallments > 0 ? (inst.paid / inst.totalInstallments) * 100 : 0
            return (
              <div
                key={inst.id}
                className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-4 cursor-pointer hover:bg-[#141424] active:scale-[0.99] transition-all"
                onClick={() => setEditing(inst)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {inst.status === 'QUITADO'
                      ? <CheckCircle2 className="w-4 h-4 text-[#00e5aa] shrink-0" />
                      : <Clock className="w-4 h-4 text-[#4d8dff] shrink-0" />
                    }
                    <span className="text-white text-sm font-medium truncate">{inst.description}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      inst.status === 'QUITADO' ? 'bg-[#00e5aa]/10 text-[#00e5aa]' : 'bg-[#4d8dff]/10 text-[#4d8dff]'
                    }`}>
                      {inst.status}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(inst.id) }}
                      className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#404060] hover:text-[#ff3366] hover:bg-[#ff3366]/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {inst.totalInstallments > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-[#7070a0] mb-1.5">
                      <span>{inst.paid}/{inst.totalInstallments} pagas</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${progress}%`,
                        background: inst.status === 'QUITADO'
                          ? '#00e5aa'
                          : 'linear-gradient(to right, #4d8dff, #9966ff)',
                      }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {inst.valuePerInstallment > 0 && (
                    <div>
                      <p className="text-[#7070a0] text-xs">Por mês</p>
                      <p className="text-white text-sm font-semibold">{fmt(inst.valuePerInstallment)}</p>
                    </div>
                  )}
                  {inst.remaining > 0 && inst.valuePerInstallment > 0 && (
                    <div>
                      <p className="text-[#7070a0] text-xs">Restante</p>
                      <p className="text-[#ff3366] text-sm font-semibold">{fmt(inst.remaining * inst.valuePerInstallment)}</p>
                    </div>
                  )}
                  {inst.total > 0 && (
                    <div>
                      <p className="text-[#7070a0] text-xs">Total</p>
                      <p className="text-[#9966ff] text-sm font-semibold">{fmt(inst.total)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <InstallmentModal onSave={handleSave} onClose={() => setShowModal(false)} />}
      {editing && <InstallmentModal onSave={handleEdit} onClose={() => setEditing(null)} initial={editing} />}
    </div>
  )
}
