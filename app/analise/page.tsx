'use client'
import { useState, useMemo, useCallback } from 'react'
import { Upload, Loader2, Sparkles, AlertTriangle } from 'lucide-react'
import { parseExtrato, RawTransaction } from '@/lib/extrato-parser'
import { fmt } from '@/lib/format'
import { useData } from '@/lib/store'
import { AnalyzedTransaction } from '@/lib/types'

const LEVEL_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  essencial: { label: 'Essencial', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  util: { label: 'Útil', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  superfluo: { label: 'Besteira', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

export default function AnalisePage() {
  const { data, setData } = useData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txs, setTxs] = useState<AnalyzedTransaction[] | null>(null)
  const [insights, setInsights] = useState<string[]>([])

  const analyze = useCallback(async (raw: RawTransaction[]) => {
    if (!raw.length) {
      setError('Não consegui ler nenhuma transação desse arquivo. Confere se é o extrato em CSV ou OFX.')
      return
    }
    setLoading(true)
    setError(null)
    setTxs(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: raw }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? 'Erro ao analisar.')
        return
      }
      const analyzed = payload.transactions as AnalyzedTransaction[]
      const newInsights: string[] = payload.insights ?? []
      setTxs(analyzed)
      setInsights(newInsights)
      // Persiste o resultado (localStorage + Supabase) pra o Resumo/Gastos lerem
      // sem re-chamar a API. ponytail: substitui a última análise, não acumula ainda.
      if (data) setData({ ...data, analyzed, insights: newInsights })
    } catch {
      setError('Falha de conexão ao analisar.')
    } finally {
      setLoading(false)
    }
  }, [data, setData])

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text()
    analyze(parseExtrato(text))
  }, [analyze])

  // Resumo dos vazamentos: total por nível.
  const summary = useMemo(() => {
    if (!txs) return null
    const out = txs.filter((t) => t.amount < 0)
    const sum = (lvl: string) => out.filter((t) => t.level === lvl).reduce((s, t) => s + Math.abs(t.amount), 0)
    return {
      total: out.reduce((s, t) => s + Math.abs(t.amount), 0),
      superfluo: sum('superfluo'),
      util: sum('util'),
      essencial: sum('essencial'),
    }
  }, [txs])

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Sparkles className="w-5 h-5 text-[#4d8dff]" />
        <h1 className="text-xl font-semibold">Analisar extrato</h1>
      </div>
      <p className="text-[#7070a0] text-sm mb-6">
        Suba o extrato do banco (CSV ou OFX). A IA lê, categoriza e mostra onde está vazando dinheiro.
      </p>

      {!txs && !loading && (
        <label className="block border-2 border-dashed border-[#1a1a2e] rounded-2xl p-10 text-center cursor-pointer hover:border-[#4d8dff]/50 transition-colors">
          <input
            type="file"
            accept=".csv,.ofx,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <Upload className="w-8 h-8 text-[#4d8dff] mx-auto mb-3" />
          <p className="font-medium">Clique para escolher o extrato</p>
          <p className="text-[#7070a0] text-sm mt-1">CSV ou OFX exportado do app do banco</p>
        </label>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-[#7070a0]">
          <Loader2 className="w-7 h-7 animate-spin text-[#4d8dff] mb-3" />
          Lendo e categorizando com a IA...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 bg-[#f87171]/10 border border-[#f87171]/30 rounded-xl p-4 mt-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
          <span className="text-[#f87171]">{error}</span>
        </div>
      )}

      {summary && (
        <>
          {/* Onde sobra */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card label="Total gasto" value={summary.total} color="#ffffff" />
            <Card label="Essencial" value={summary.essencial} color={LEVEL_STYLE.essencial.color} />
            <Card label="Útil" value={summary.util} color={LEVEL_STYLE.util.color} />
            <Card label="Besteira" value={summary.superfluo} color={LEVEL_STYLE.superfluo.color} highlight />
          </div>

          {insights.length > 0 && (
            <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4d8dff]" /> Onde dá pra sobrar
              </h2>
              <ul className="space-y-2">
                {insights.map((it, i) => (
                  <li key={i} className="text-sm text-[#b0b0d0] flex gap-2">
                    <span className="text-[#4d8dff]">•</span>{it}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lista de transações */}
          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a2e] flex items-center justify-between">
              <h2 className="text-sm font-semibold">{txs!.length} transações</h2>
              <button onClick={() => { setTxs(null); setInsights([]) }} className="text-xs text-[#7070a0] hover:text-white">
                Analisar outro
              </button>
            </div>
            <div className="divide-y divide-[#1a1a2e]">
              {txs!.map((t, i) => {
                const st = LEVEL_STYLE[t.level] ?? LEVEL_STYLE.util
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.description}</p>
                      <p className="text-xs text-[#7070a0]">
                        {t.date} · {t.category}{t.reason ? ` · ${t.reason}` : ''}
                      </p>
                    </div>
                    {t.amount < 0 && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {st.label}
                      </span>
                    )}
                    <span className={`text-sm font-medium shrink-0 ${t.amount < 0 ? 'text-white' : 'text-[#4ade80]'}`}>
                      {fmt(t.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-[#141424] border rounded-2xl p-4 ${highlight ? 'border-[#f87171]/40' : 'border-[#1a1a2e]'}`}>
      <p className="text-xs text-[#7070a0] mb-1">{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>{fmt(value)}</p>
    </div>
  )
}
