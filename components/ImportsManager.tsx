'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2, Repeat } from 'lucide-react'
import { useData } from '@/lib/store'
import { fmt } from '@/lib/format'
import { CATEGORIES, LEVEL_META, ImportGroup, SpendingLevel } from '@/lib/types'

const LEVELS = (Object.keys(LEVEL_META) as SpendingLevel[]).map((v) => ({ v, ...LEVEL_META[v] }))

function groupTotal(g: ImportGroup): number {
  return g.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)
}

// Lista de extratos/faturas importados. Cada grupo abre pra ver e EDITAR os itens
// (nome, valor, categoria, nível), apagar item ou o grupo inteiro.
export default function ImportsManager() {
  const { data, setData } = useData()
  const imports = data?.imports ?? []
  const [open, setOpen] = useState<Set<string>>(new Set())

  if (!data || imports.length === 0) return null

  // Updater funcional: cada edição parte do estado ATUAL — edições rápidas em
  // sequência não se perdem.
  const commit = (fn: (prev: ImportGroup[]) => ImportGroup[]) =>
    setData((prev) => ({ ...prev, imports: fn(prev.imports ?? []) }))
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const editItem = (gid: string, tid: string, patch: Partial<ImportGroup['transactions'][number]>) =>
    commit((prev) => prev.map((g) => g.id === gid ? { ...g, transactions: g.transactions.map((t) => t.id === tid ? { ...t, ...patch } : t) } : g))
  const deleteItem = (gid: string, tid: string) =>
    commit((prev) => prev.map((g) => g.id === gid ? { ...g, transactions: g.transactions.filter((t) => t.id !== tid) } : g))
  const renameGroup = (gid: string, source: string) =>
    commit((prev) => prev.map((g) => g.id === gid ? { ...g, source } : g))
  const deleteGroup = (gid: string) => commit((prev) => prev.filter((g) => g.id !== gid))

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold mb-3 text-[#7070a0]">Seus extratos ({imports.length})</h2>
      <div className="space-y-3">
        {[...imports].reverse().map((g) => {
          const aberto = open.has(g.id)
          return (
            <div key={g.id} className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden">
              {/* Cabeçalho do grupo (macro) */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggle(g.id)} className="text-[#7070a0] hover:text-white shrink-0">
                  {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <input
                  defaultValue={g.source}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.source) renameGroup(g.id, v) }}
                  className="bg-transparent text-sm font-medium text-white outline-none flex-1 min-w-0 focus:bg-[#0d0d1a] rounded px-1 py-0.5"
                />
                <span className="text-xs text-[#505070] shrink-0">{g.transactions.length} itens</span>
                <span className="text-sm font-semibold text-white shrink-0">{fmt(groupTotal(g))}</span>
                <button onClick={() => deleteGroup(g.id)} className="text-[#505070] hover:text-[#f87171] shrink-0" title="Apagar extrato">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Itens (micro, editáveis) */}
              {aberto && (
                <div className="border-t border-[#1a1a2e] divide-y divide-[#1a1a2e]/60">
                  {g.transactions.map((t) => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <input
                        defaultValue={t.description}
                        onBlur={(e) => { const v = e.target.value; if (v !== t.description) editItem(g.id, t.id, { description: v }) }}
                        className="bg-transparent text-sm text-white outline-none flex-1 min-w-[120px] focus:bg-[#0d0d1a] rounded px-1 py-0.5"
                      />
                      <select
                        defaultValue={t.category}
                        onChange={(e) => editItem(g.id, t.id, { category: e.target.value })}
                        className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg text-xs text-[#b0b0d0] px-2 py-1 outline-none"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        defaultValue={t.level}
                        onChange={(e) => editItem(g.id, t.id, { level: e.target.value as SpendingLevel })}
                        className="bg-[#0d0d1a] border border-[#1a1a2e] rounded-lg text-xs px-2 py-1 outline-none"
                        style={{ color: LEVELS.find((l) => l.v === t.level)?.color ?? '#b0b0d0' }}
                      >
                        {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
                      </select>
                      {t.recurring && <Repeat className="w-3 h-3 text-[#fbbf24] shrink-0" aria-label="recorrente" />}
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={t.amount}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value)
                          if (isNaN(v)) return
                          // Preserva o sinal original: corrigir "39.90" pra "42" num
                          // gasto continua gasto — não vira renda por falta do "-".
                          const signed = t.amount < 0 ? -Math.abs(v) : Math.abs(v)
                          if (signed !== t.amount) editItem(g.id, t.id, { amount: signed })
                        }}
                        className="bg-transparent text-sm font-medium text-right outline-none w-24 focus:bg-[#0d0d1a] rounded px-1 py-0.5"
                        style={{ color: t.amount < 0 ? '#ffffff' : '#4ade80' }}
                      />
                      <button onClick={() => deleteItem(g.id, t.id)} className="text-[#505070] hover:text-[#f87171] shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-[#505070] mt-3">
        Toque no nome, categoria ou valor pra editar. A IA faz o rascunho, você ajusta.
      </p>
    </div>
  )
}
