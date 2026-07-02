'use client'
import { useState, useCallback } from 'react'
import { Upload, Loader2, Sparkles, AlertTriangle, FileText, Camera, CheckCircle2 } from 'lucide-react'
import { parseExtrato, RawTransaction } from '@/lib/extrato-parser'
import { fileToScaledBase64, fileToBase64 } from '@/lib/image'
import { authHeaders } from '@/lib/api'
import { fmt } from '@/lib/format'
import { useData } from '@/lib/store'
import { AnalyzedTransaction, Holerite, ImportGroup } from '@/lib/types'
import ImportsManager from '@/components/ImportsManager'

type Mode = 'extrato' | 'holerite'

export default function AnalisePage() {
  const { data, setData } = useData()
  const [mode, setMode] = useState<Mode>('extrato')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holerite, setHolerite] = useState<Holerite | null>(null)
  const [imported, setImported] = useState<string | null>(null)

  const switchMode = (m: Mode) => { setMode(m); setError(null); setHolerite(null); setImported(null) }

  // Cria uma fatura (grupo com itens) a partir do resultado da IA e salva.
  const applyResult = useCallback((payload: { transactions: Omit<AnalyzedTransaction, 'id'>[]; insights?: string[]; source?: string }) => {
    const base = Date.now()
    const transactions: AnalyzedTransaction[] = payload.transactions.map((t, i) => ({ ...t, id: `tx_${base}_${i}` }))
    const source = payload.source || 'Extrato'
    const group: ImportGroup = { id: `imp_${base}`, source, importedAt: new Date().toISOString(), transactions }
    if (data) setData({ ...data, imports: [...(data.imports ?? []), group], insights: payload.insights ?? data.insights })
    setImported(source)
  }, [data, setData])

  const analyze = useCallback(async (raw: RawTransaction[]) => {
    if (!raw.length) { setError('Não achei transações nesse arquivo. É mesmo CSV/OFX?'); return }
    setLoading(true); setError(null); setImported(null)
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ transactions: raw }) })
      const payload = await res.json()
      if (!res.ok) { setError(payload.error ?? 'Erro ao analisar.'); return }
      applyResult(payload)
    } catch { setError('Falha de conexão ao analisar.') } finally { setLoading(false) }
  }, [applyResult])

  const analyzeFoto = useCallback(async (file: File) => {
    setLoading(true); setError(null); setImported(null)
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
      const { base64, mediaType } = isPdf ? await fileToBase64(file) : await fileToScaledBase64(file)
      const res = await fetch('/api/extrato-foto', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ data: base64, mediaType }) })
      const payload = await res.json()
      if (!res.ok) { setError(payload.error ?? 'Erro ao ler.'); return }
      applyResult(payload)
    } catch {
      setError('Não consegui ler essa imagem. Se for foto do iPhone (HEIC), salva como JPG ou tira um print e tenta de novo.')
    } finally { setLoading(false) }
  }, [applyResult])

  const handleExtrato = useCallback(async (file: File) => {
    setError(null)
    try {
      const nome = file.name.toLowerCase()
      if (/\.(csv|ofx|txt|qfx)$/i.test(nome) || /text|csv/.test(file.type)) {
        const parsed = parseExtrato(await file.text())
        if (!parsed.length) { setError('Não achei transações. É CSV/OFX? Se for foto/PDF, funciona também.'); return }
        analyze(parsed)
      } else if (/\.(xlsx|xls)$/i.test(nome) || /sheet|excel/.test(file.type)) {
        // Excel → converte pra CSV com a lib xlsx e usa o mesmo parser.
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer())
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
        const parsed = parseExtrato(csv)
        if (!parsed.length) { setError('Não achei transações nessa planilha. Confere se tem colunas de data, descrição e valor.'); return }
        analyze(parsed)
      } else {
        // PDF ou imagem → visão.
        analyzeFoto(file)
      }
    } catch {
      setError('Não consegui abrir esse arquivo. Se for foto do iPhone (HEIC), tenta salvar como JPG ou tirar um print.')
    }
  }, [analyze, analyzeFoto])

  const handleHolerite = useCallback(async (file: File) => {
    setLoading(true); setError(null); setHolerite(null)
    try {
      const { base64, mediaType } = await fileToScaledBase64(file)
      const res = await fetch('/api/holerite', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ image: base64, mediaType }) })
      const payload = await res.json()
      if (!res.ok) { setError(payload.error ?? 'Erro ao ler o holerite.'); return }
      const h: Holerite = { ...payload.holerite, addedAt: new Date().toISOString() }
      setHolerite(h)
      if (data) setData({ ...data, holerites: [...(data.holerites ?? []), h] })
    } catch { setError('Falha ao processar a imagem.') } finally { setLoading(false) }
  }, [data, setData])

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Sparkles className="w-5 h-5 text-[#4d8dff]" />
        <h1 className="text-xl font-semibold">Analisar</h1>
      </div>
      <p className="text-[#7070a0] text-sm mb-5">
        Sobe extrato ou fatura (CSV, OFX, PDF ou foto) — a IA lê, agrupa e categoriza; você confere e edita. Ou foto do holerite pra registrar sua renda.
      </p>

      <div className="inline-flex bg-[#141424] border border-[#1a1a2e] rounded-xl p-1 mb-6">
        <ModeButton active={mode === 'extrato'} onClick={() => switchMode('extrato')} icon={FileText} label="Extrato / Fatura" />
        <ModeButton active={mode === 'holerite'} onClick={() => switchMode('holerite')} icon={Camera} label="Holerite (foto)" />
      </div>

      {!loading && (
        mode === 'extrato' ? (
          <UploadBox onFile={handleExtrato} title="Escolher extrato ou fatura" hint="CSV, OFX, PDF ou foto (extrato / fatura / nota)" />
        ) : (
          <UploadBox onFile={handleHolerite} title="Foto do holerite" hint="Contracheque — pode estar torto, a IA lê" />
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

      {imported && !loading && (
        <div className="flex items-center gap-2 bg-[#4ade80]/10 border border-[#4ade80]/30 rounded-xl p-3 mt-4 text-sm text-[#4ade80]">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> &ldquo;{imported}&rdquo; importado e categorizado. Confira e edite abaixo.
        </div>
      )}

      {holerite && <HoleriteResult h={holerite} onReset={() => setHolerite(null)} />}

      {mode === 'extrato' && <ImportsManager />}
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

function UploadBox({ onFile, title, hint }: { onFile: (f: File) => void; title: string; hint: string }) {
  // Sem "accept": bancos exportam formatos variados (e o filtro apagava os
  // arquivos no seletor). O código roteia por tipo depois. */
  return (
    <label className="block border-2 border-dashed border-[#1a1a2e] rounded-2xl p-10 text-center cursor-pointer hover:border-[#4d8dff]/50 transition-colors">
      <input
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
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
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl overflow-hidden mt-4">
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
