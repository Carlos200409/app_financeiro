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

export function applyImport(
  prev: FinanceData,
  payload: ImportPayload,
): { next: FinanceData; group: ImportGroup; parcelasPagas: string[]; periodo: string | null } {
  const base = Date.now()
  const transactions: AnalyzedTransaction[] = payload.transactions.map((t, i) => ({ ...t, id: `tx_${base}_${i}` }))
  const group: ImportGroup = {
    id: `imp_${base}`,
    source: payload.source || 'Extrato',
    importedAt: new Date().toISOString(),
    transactions,
    verdict: payload.verdict || undefined,
  }

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

  return {
    next: { ...prev, imports: [...(prev.imports ?? []), group], installments },
    group,
    parcelasPagas,
    periodo: periodos.length ? periodos[periodos.length - 1] : null,
  }
}
