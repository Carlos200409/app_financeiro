'use client'
import { useState } from 'react'
import { Plus, X, TrendingUp, TrendingDown, CreditCard, PiggyBank } from 'lucide-react'
import { useData, saveData } from '@/lib/store'
import { Transaction, Installment, Investment } from '@/lib/types'
import TransactionModal from './TransactionModal'

type Mode = 'receita' | 'fixo' | 'extra' | 'parcela' | 'investimento' | null

export default function QuickAdd() {
  const { data, setData, currentMonth } = useData()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(null)

  if (!data) return null

  const close = () => { setOpen(false); setMode(null) }

  const handleTx = (tx: Omit<Transaction, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newTx: Transaction = { ...tx, id }
    const delta = tx.category === 'receita' ? tx.value : -tx.value
    setData((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTx],
      monthlySummaries: prev.monthlySummaries.map(s => {
        if (s.month !== tx.month) return s
        return {
          ...s,
          receita:      tx.category === 'receita' ? s.receita + tx.value : s.receita,
          fixos:        tx.category === 'fixo'    ? s.fixos   + tx.value : s.fixos,
          extras:       tx.category === 'extra'   ? s.extras  + tx.value : s.extras,
          saldo: s.saldo + delta,
        }
      }),
    }))
    close()
  }

  const actions = [
    { id: 'receita',     label: 'Receita',     icon: TrendingUp,   color: '#00e5aa', bg: 'bg-[#00e5aa]/15' },
    { id: 'fixo',        label: 'Gasto fixo',  icon: TrendingDown, color: '#4d8dff', bg: 'bg-[#4d8dff]/15' },
    { id: 'extra',       label: 'Extra/Lazer', icon: TrendingDown, color: '#ffcc00', bg: 'bg-[#ffcc00]/15' },
    { id: 'investimento',label: 'Investimento',icon: PiggyBank,    color: '#9966ff', bg: 'bg-[#9966ff]/15' },
    { id: 'parcela',     label: 'Parcela',     icon: CreditCard,   color: '#ff9966', bg: 'bg-[#ff9966]/15' },
  ] as const

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={close} />
      )}

      {/* Action menu */}
      {open && !mode && (
        <div className="fixed bottom-24 md:bottom-8 right-4 z-50 flex flex-col gap-2">
          {actions.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setMode(a.id as Mode)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 backdrop-blur-md shadow-xl transition-all ${a.bg}`}
              style={{
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: a.color + '20' }}>
                <a.icon className="w-4 h-4" style={{ color: a.color }} />
              </div>
              <span className="text-white font-medium text-sm pr-2">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-20 md:bottom-6 right-4 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-[#1a1a2e] border border-[#2a2a44] rotate-45'
            : 'bg-gradient-to-br from-[#4d8dff] to-[#9966ff] shadow-[#4d8dff]/30'
        }`}
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <Plus className="w-6 h-6 text-white" />
        }
      </button>

      {/* Modais de cada tipo */}
      {(mode === 'receita' || mode === 'fixo' || mode === 'extra') && (
        <TransactionModal
          month={currentMonth}
          onSave={handleTx}
          onClose={close}
          initial={mode ? { id: '', month: currentMonth, category: mode, description: '', value: 0 } : undefined}
        />
      )}

      {mode === 'investimento' && (
        <InvestimentoModal
          onSave={(inv) => {
            setData((prev) => ({ ...prev, investments: [...prev.investments, { ...inv, id: `inv_${Date.now()}` }] }))
            close()
          }}
          onClose={close}
        />
      )}

      {mode === 'parcela' && (
        <ParcelaModal
          onSave={(inst) => {
            setData((prev) => ({ ...prev, installments: [...prev.installments, { ...inst, id: `inst_${Date.now()}` }] }))
            close()
          }}
          onClose={close}
        />
      )}
    </>
  )
}

// ── Inline mini-modals ──────────────────────────────────────────────────────

function InvestimentoModal({ onSave, onClose }: { onSave: (i: Omit<Investment, 'id'>) => void; onClose: () => void }) {
  const [category, setCategory] = useState('')
  const [value, setValue] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = parseFloat(value.replace(',', '.'))
    if (!category.trim() || isNaN(v)) return
    onSave({ category: category.trim(), value: v })
  }
  return (
    <MiniModal title="Novo investimento" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Categoria" value={category} onChange={setCategory} placeholder="Ex: Renda Fixa / CDB" />
        <Field label="Valor (R$)" value={value} onChange={setValue} placeholder="0,00" inputMode="decimal" />
        <SubmitBtn>Adicionar investimento</SubmitBtn>
      </form>
    </MiniModal>
  )
}

function ParcelaModal({ onSave, onClose }: { onSave: (i: Omit<Installment, 'id'>) => void; onClose: () => void }) {
  const [desc, setDesc] = useState('')
  const [parcVal, setParcVal] = useState('')
  const [total, setTotal] = useState('')
  const [paid, setPaid] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const pv = parseFloat(parcVal.replace(',', '.')) || 0
    const t = parseInt(total) || 0
    const p = parseInt(paid) || 0
    if (!desc.trim()) return
    onSave({
      description: desc.trim(),
      total: pv * t,
      installmentAmount: pv * p,
      valuePerInstallment: pv,
      totalInstallments: t,
      status: 'ATIVO',
      paid: p,
      remaining: t - p,
      advance: false,
    })
  }
  return (
    <MiniModal title="Nova parcela" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Descrição" value={desc} onChange={setDesc} placeholder="Ex: Notebook Dell" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Valor/parcela" value={parcVal} onChange={setParcVal} placeholder="0,00" inputMode="decimal" />
          <Field label="Total parc." value={total} onChange={setTotal} placeholder="12" inputMode="numeric" />
          <Field label="Pagas" value={paid} onChange={setPaid} placeholder="0" inputMode="numeric" />
        </div>
        <SubmitBtn>Adicionar parcela</SubmitBtn>
      </form>
    </MiniModal>
  )
}

function MiniModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#141424] flex items-center justify-center text-[#7070a0] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return (
    <div>
      <label className="text-[#7070a0] text-xs mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full bg-[#141424] border border-[#1a1a2e] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#404066] focus:outline-none focus:border-[#4d8dff]/50"
      />
    </div>
  )
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4d8dff] to-[#9966ff] text-white font-semibold text-sm hover:opacity-90 mt-1">
      {children}
    </button>
  )
}
