'use client'
import { useState, useMemo, useCallback } from 'react'
import { Upload, Loader2, Sparkles, AlertTriangle, FileText, Camera, CheckCircle2 } from 'lucide-react'
import { parseExtrato, RawTransaction } from '@/lib/extrato-parser'
import { fileToScaledBase64, fileToBase64 } from '@/lib/image'
import { fmt } from '@/lib/format'
import { useData } from '@/lib/store'
import { AnalyzedTransaction, Holerite } from '@/lib/types'

type Mode = 'extrato' | 'holerite'

const LEVEL_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  essencial: { label: 'Essencial', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  util: { label: 'Útil', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  superfluo: { label: 'Besteira', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

export default function AnalisePage() {
  const { data, setData } = useData()
  const [mode, setMode] = useState<Mode>('extrato')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txs, setTxs] = useState<AnalyzedTransaction[] | null>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [holerite, setHolerite] = useState<Holerite | null>(null)

  const reset = () => { setError(null); setTxs(null); setInsights([]); setHolerite(null) }
  const switchMode = (m: Mode) => { setMode(m); reset() }

  // Aplica o resultado (texto ou visão) — mesma tela, mesma persistência.
  const applyResult = useCallback((payload: { transactions: AnalyzedTransaction[]; insights?: string[] }) => {
    const analyzed = payload.transactions
    const newInsights = payload.insights ?? []
    setTxs(analyzed)
    setInsights(newInsights)
    if (data) setData({ ...data, analyzed, insights: newInsights })
  }, [data, setData])

  // --- Extrato em texto (CSV/OFX) ---
  const analyze = useCallback(async (raw: RawTransaction[]) => {
    if (!raw.length) {
      setError('Não consegui ler nenhuma transação desse arquivo. Confere se é o extrato em CSV ou OFX.')
      return
    }
    const comData = raw.filter((t) => /^\d{4}-\d{2}-\d{2}/.test(t.date)).length
    if (comData < 2 || comData < raw.length * 0.3) {
      setError('Isso não parece um extrato. Se for foto/PDF, tudo bem — deixa eu ler por imagem (pode demorar uns segundos).')
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
      if (!res.ok) { setError(payload.error ?? 'Erro ao analisar.'); return }
      applyResult(payload)
    } catch {
      setError('Falha de conexão ao analisar.')
    } finally {
      setLoading(false)
    }
  }, [applyResult])

  // --- Extrato/fatura/nota fiscal por foto ou PDF (visão) ---
  const analyzeFoto = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setTxs(null)
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
      const { base64, mediaType } = isPdf ? await fileToBase64(file) : await fileToScaledBase64(file)
      const res = await fetch('/api/extrato-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mediaType }),
      })
      const payload = await res.json()
      if (!res.ok) { setError(payload.error ?? 'Erro ao ler.'); return }
      applyResult(payload)
    } catch {
      setError('Falha ao processar o arquivo.')
    } finally {
      setLoading(false)
    }
  }, [applyResult])

  const handleExtrato = useCallback(async (file: File) => {
    // Texto → parser rápido/barato. PDF ou imagem → visão.
    if (/\.(csv|ofx|txt)$/i.test(file.name)) {
      const text = await file.text()
      analyze(parseExtrato(text))
    } else {
      analyzeFoto(file)
    }
  }, [analyze, analyzeFoto])

  // --- Holerite (foto) ---
  const handleHolerite = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setHolerite(null)
    try {
      const { base64, mediaType } = await fileToScaledBase64(file)
      const res = await fetch('/api/holerite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? 'Erro ao ler o holerite.')
        return
      }
      const h: Holerite = { ...payload.holerite, addedAt: new Date().toISOString() }
      setHolerite(h)
      // Salva (acumula holerites — vários meses). Sincroniza no Supabase.
      if (data) setData({ ...data, holerites: [...(data.holerites ?? []), h] })
    } catch {
      setError('Falha ao processar a imagem.')
    } finally {
      setLoading(false)
    }
  }, [data, setData])

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
        <h1 className="text-xl font-semibold">Analisar</h1>
      </div>
      <p className="text-[#7070a0] text-sm mb-5">
        Extrato pra ver gastos (CSV, OFX, PDF ou foto), ou foto do holerite pra registrar sua renda.
      </p>

      {/* Toggle de modo */}
      <div className="inline-flex bg-[#141424] border border-[#1a1a2e] rounded-xl p-1 mb-6">
        <ModeButton active={mode === 'extrato'} onClick={() => switchMode('extrato')} icon={FileText} label="Extrato (CSV/OFX)" />
        <ModeButton active={mode === 'holerite'} onClick={() => switchMode('holerite')} icon={Camera} label="Holerite (foto)" />
      </div>

      {/* Dropzone */}
      {!loading && !txs && !holerite && (
        mode === 'extrato' ? (
          <UploadBox
            accept=".csv,.ofx,.txt,.pdf,image/*"
            onFile={handleExtrato}
            title="Clique para escolher o extrato"
            hint="CSV, OFX, PDF ou foto do extrato/nota fiscal"
          />
        ) : (
          <UploadBox
            accept="image/*"
            onFile={handleHolerite}
            title="Tire ou escolha a foto do holerite"
            hint="Foto do contracheque — pode estar torta, a IA lê"
          />
        )
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-[#7070a0]">
          <Loader2 className="w-7 h-7 animate-spin text-[#4d8dff] mb-3" />
          {mode === 'extrato' ? 'Lendo e categorizando com a IA...' : 'Lendo o holerite com a IA...'}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 bg-[#f87171]/10 border border-[#f87171]/30 rounded-xl p-4 mt-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
          <span className="text-[#f87171]">{error}</span>
        </div>
      )}

      {/* Resultado holerite */}
      {holerite && <HoleriteResult h={holerite} onReset={reset} />}

      {/* Resultado extrato */}
      {summary && (
        <>
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

          <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a2e] flex items-center justify-between">
              <h2 className="text-sm font-semibold">{txs!.length} transações</h2>
              <button onClick={reset} className="text-xs text-[#7070a0] hover:text-white">Analisar outro</button>
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
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ color: st.color, background: st.bg }}>
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

function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof FileText; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-[#4d8dff] text-white' : 'text-[#7070a0] hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function UploadBox({ accept, onFile, title, hint }: { accept: string; onFile: (f: File) => void; title: string; hint: string }) {
  return (
    <label className="block border-2 border-dashed border-[#1a1a2e] rounded-2xl p-10 text-center cursor-pointer hover:border-[#4d8dff]/50 transition-colors">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <Upload className="w-8 h-8 text-[#4d8dff] mx-auto mb-3" />
      <p className="font-medium">{title}</p>
      <p className="text-[#7070a0] text-sm mt-1">{hint}</p>
    </label>
  )
}

function HoleriteResult({ h, onReset }: { h: Holerite; onReset: () => void }) {
  const rows: [string, string][] = [
    ['Competência', h.competencia || '—'],
    ['Tipo', h.tipo],
    ['Empregador', h.empregador || '—'],
    ['Salário base', h.salarioBase ? fmt(h.salarioBase) : '—'],
    ['Bruto (este recibo)', fmt(h.bruto)],
    ['Descontos', fmt(h.descontos)],
  ]
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a1a2e] flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-[#4ade80]" />
        <span className="font-semibold">Holerite lido</span>
        {h.confianca !== 'alta' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fbbf24]/12 text-[#fbbf24]">confira, leitura {h.confianca}</span>
        )}
        <button onClick={onReset} className="ml-auto text-xs text-[#7070a0] hover:text-white">Ler outro</button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-[#1a1a2e]/60 pb-2">
              <span className="text-[#7070a0]">{k}</span>
              <span className="text-white font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-[#4ade80]/8 border border-[#4ade80]/25 p-4 flex items-center justify-between">
          <span className="text-sm text-[#b0b0d0]">Líquido recebido</span>
          <span className="text-xl font-bold text-[#4ade80]">{fmt(h.liquido)}</span>
        </div>
        <p className="text-xs text-[#7070a0] mt-3">
          ✓ Salvo como renda fixa no Resumo.{h.tipo === 'adiantamento' ? ' É um adiantamento — quando vier o fechamento do mês, sobe também que eu somo.' : ''}
        </p>
      </div>
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
