import { AnalyzedTransaction, FinanceData, ImportGroup } from './types'

// Lógica única de "resultado da IA → fatura salva + parcelas pagas".
// Usada pela tela Analisar e pelo ingest do WhatsApp — pura, sem React.

export interface ImportPayload {
  transactions: Omit<AnalyzedTransaction, 'id'>[]
  verdict?: string
  source?: string
}

// Fração (0..1) dos itens novos que já existem — pro anti-duplicação.
export function dupFraction(prev: FinanceData, transactions: ImportPayload['transactions']): number {
  if (!transactions.length) return 0
  const existentes = new Set((prev.imports ?? []).flatMap((g) => g.transactions).map((t) => `${t.date}|${t.amount}|${t.description}`))
  const repetidas = transactions.filter((t) => existentes.has(`${t.date}|${t.amount}|${t.description}`)).length
  return repetidas / transactions.length
}

// ── Reconciliação WhatsApp ↔ fatura/extrato ──────────────────────────────────
// Gasto reportado por mensagem ("comprei tênis, 250 no crédito em 3x") depois
// aparece na fatura oficial — sem isto, contaria 2x. Quando um item importado
// casa com um registro do WhatsApp, o registro manual sai (a fatura é a fonte
// oficial). À vista: mesmo valor ±R$0,02 e data ±5 dias. Parcelado: valor da
// fatura ≈ valor reportado ÷ N ("3x") + uma palavra em comum na descrição.

function diasEntre(a?: string, b?: string): number {
  const pa = Date.parse(a ?? ''), pb = Date.parse(b ?? '')
  if (isNaN(pa) || isNaN(pb)) return Infinity
  return Math.abs(pa - pb) / 86_400_000
}

function palavraEmComum(a: string, b: string): boolean {
  const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4))
  const ta = tokens(a)
  return [...tokens(b)].some((w) => ta.has(w))
}

function casa(wa: AnalyzedTransaction, inc: { date: string; description: string; amount: number }): boolean {
  if (wa.amount >= 0 || inc.amount >= 0) return false
  // À vista: mesmo valor, datas próximas.
  if (Math.abs(wa.amount - inc.amount) <= 0.02 && diasEntre(wa.date, inc.date) <= 5) return true
  // Parcelado: reportou o TOTAL ("3x"); a fatura traz a parcela (total ÷ N).
  const n = parseInt(wa.parcelasInfo?.match(/^(\d+)\s*x$/i)?.[1] ?? '', 10)
  if (n >= 2) {
    const parcela = Math.abs(wa.amount) / n
    if (Math.abs(Math.abs(inc.amount) - parcela) <= Math.max(0.05, parcela * 0.02) && palavraEmComum(wa.description, inc.description)) return true
  }
  return false
}

export function applyImport(
  prev: FinanceData,
  payload: ImportPayload,
): { next: FinanceData; group: ImportGroup; parcelasPagas: string[]; periodo: string | null; unificados: string[] } {
  const base = Date.now()
  const transactions: AnalyzedTransaction[] = payload.transactions.map((t, i) => ({ ...t, id: `tx_${base}_${i}` }))
  // Parcelas que a IA detectou como pagas neste extrato → avança o contador.
  const pagas = [...new Set(transactions.map((t) => t.parcelaId).filter((p): p is string => !!p))]
  const parcelasPagas: string[] = []
  const installments = (prev.installments ?? []).map((p) => {
    if (!pagas.includes(p.id) || p.status !== 'ATIVO') return p
    const paid = Math.min(p.paid + 1, p.totalInstallments)
    const remaining = p.totalInstallments - paid
    parcelasPagas.push(`${p.description} (${paid}/${p.totalInstallments})`)
    return { ...p, paid, remaining, status: remaining <= 0 ? ('QUITADO' as const) : ('ATIVO' as const) }
  })

  const periodos = transactions
    .map((t) => t.date.match(/^\d{4}-\d{2}/)?.[0])
    .filter((p): p is string => !!p)
    .sort()
  const periodo = periodos.length ? periodos[periodos.length - 1] : null

  // WhatsApp: consolida num ÚNICO grupo por MÊS (não um grupo por mensagem) —
  // vira um "feed" do que você registrou no mês. Outras fontes = grupo novo.
  const unificados: string[] = []
  let group: ImportGroup
  let imports: ImportGroup[]
  if ((payload.source || 'Extrato') === 'WhatsApp') {
    const doMes = (g: ImportGroup) =>
      g.source === 'WhatsApp' && g.transactions.some((t) => (t.date.match(/^\d{4}-\d{2}/)?.[0] ?? null) === periodo)
    const existentes = (prev.imports ?? []).filter(doMes)
    if (existentes.length) {
      // Junta TODOS os grupos WhatsApp do mês (+ os novos) num só — também
      // limpa grupos antigos duplicados que já estavam salvos.
      group = { ...existentes[0], transactions: [...existentes.flatMap((g) => g.transactions), ...transactions] }
      imports = [...(prev.imports ?? []).filter((g) => !doMes(g)), group]
    } else {
      group = { id: `imp_${base}`, source: 'WhatsApp', importedAt: new Date().toISOString(), transactions }
      imports = [...(prev.imports ?? []), group]
    }
  } else {
    group = {
      id: `imp_${base}`,
      source: payload.source || 'Extrato',
      importedAt: new Date().toISOString(),
      transactions,
      verdict: payload.verdict || undefined,
    }
    // Reconciliação: import oficial remove registros do WhatsApp que casem com
    // seus itens (senão a mesma compra conta 2x).
    const usados = new Set<string>()
    imports = [...(prev.imports ?? []), group].map((g) => {
      if (g.id === group.id || g.source !== 'WhatsApp') return g
      return {
        ...g,
        transactions: g.transactions.filter((wa) => {
          const match = transactions.find((inc) => !usados.has(`${inc.id}`) && casa(wa, inc))
          if (match) {
            usados.add(`${match.id}`)
            unificados.push(wa.description)
            return false
          }
          return true
        }),
      }
    }).filter((g) => g.transactions.length > 0) // grupo do WhatsApp esvaziou → sai
  }

  return {
    next: { ...prev, imports, installments },
    group,
    parcelasPagas,
    periodo,
    unificados,
  }
}
