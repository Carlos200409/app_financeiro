import { AnalyzedTransaction, FinanceData } from './types'
import { computeSummary, previousPeriod } from './finance-summary'

// Caça-vazamento — detecção 100% determinística (sem IA) do desperdício matável.
// Reusa computeSummary/previousPeriod (lib/finance-summary.ts). A IA, se usada,
// só escreve a frase; o número em R$ sai daqui, confiável.

const cents = (n: number) => Math.round(Math.abs(n) * 100)

function periodOf(t: AnalyzedTransaction): string | null {
  return (t.date ?? '').match(/^\d{4}-\d{2}/)?.[0] ?? null
}

// Saídas categorizadas (itens de fatura/extrato). Transferência é neutra — mesma
// exclusão do computeSummary, senão conta pagamento de fatura como gasto.
function saidas(data: FinanceData | null, period?: string | null): AnalyzedTransaction[] {
  return (data?.imports ?? [])
    .flatMap((g) => g.transactions)
    .filter((t) => t.amount < 0 && t.category !== 'Transferência' && (!period || periodOf(t) === period))
}

function normDesc(s: string): string {
  return (s ?? '').toLowerCase().replace(/\d+/g, '').replace(/[^a-zà-ú ]/gi, '').replace(/\s+/g, ' ').trim()
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a), db = Date.parse(b)
  if (isNaN(da) || isNaN(db)) return Infinity
  return Math.abs(da - db) / 86_400_000
}

// Assinaturas/recorrentes do período. Lift do bloco inline de gastos/page.tsx,
// agora filtrado por período (conserta a inconsistência com s.assinaturas).
export function recurringCharges(data: FinanceData | null, period?: string | null): AnalyzedTransaction[] {
  return saidas(data, period).filter((t) => t.recurring)
}

export interface DuplicateGroup {
  description: string
  amount: number // valor de CADA cobrança (abs)
  count: number
  extraIds: string[] // ids das cobranças além da 1ª — o desperdício de verdade
}

// Cobranças idênticas (mesma descrição normalizada + mesmo valor) numa janela curta.
export function duplicateCharges(data: FinanceData | null, period?: string | null, windowDays = 4): DuplicateGroup[] {
  const byKey = new Map<string, AnalyzedTransaction[]>()
  for (const t of saidas(data, period)) {
    const key = `${normDesc(t.description)}|${cents(t.amount)}`
    const arr = byKey.get(key)
    if (arr) arr.push(t)
    else byKey.set(key, [t])
  }
  const out: DuplicateGroup[] = []
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => (a.date > b.date ? 1 : -1))
    const extras: AnalyzedTransaction[] = []
    for (let i = 1; i < sorted.length; i++) {
      if (daysBetween(sorted[i - 1].date, sorted[i].date) <= windowDays) extras.push(sorted[i])
    }
    if (extras.length) {
      out.push({ description: group[0].description, amount: Math.abs(group[0].amount), count: extras.length + 1, extraIds: extras.map((t) => t.id) })
    }
  }
  return out.sort((a, b) => b.amount * (b.count - 1) - a.amount * (a.count - 1))
}

export interface CreepItem { category: string; anterior: number; atual: number; deltaPct: number }

// Categorias que subiram acima do limiar vs o mês anterior. Sinal informativo
// (pode incluir essencial) — NÃO entra no total do vazamento.
export function spendingCreep(data: FinanceData | null, period: string, threshold = 0.3): CreepItem[] {
  const cur = computeSummary(data, period)
  const prev = computeSummary(data, previousPeriod(period))
  if (!cur || !prev) return []
  const prevMap = new Map(prev.categorias)
  const out: CreepItem[] = []
  for (const [cat, atual] of cur.categorias) {
    const anterior = prevMap.get(cat) ?? 0
    if (anterior > 0 && atual > anterior * (1 + threshold)) {
      out.push({ category: cat, anterior, atual, deltaPct: (atual - anterior) / anterior })
    }
  }
  return out.sort((a, b) => b.atual - b.anterior - (a.atual - a.anterior))
}

export interface LeakReport {
  total: number // desperdício matável, cada transação contada UMA vez
  besteira: number // total superfluo do período
  assinaturas: { total: number; items: AnalyzedTransaction[] }
  duplicadas: { total: number; groups: DuplicateGroup[] }
  creep: CreepItem[]
}

// O número que vende — "achei R$X que você joga fora". Conservador e honesto:
// soma superfluo + assinaturas + cobranças duplicadas, SEM dupla contagem
// (uma transação que é superflua E assinatura conta uma vez só). Aluguel
// (recorrente essencial) NÃO entra.
export function estimatedLeak(data: FinanceData | null, period: string): LeakReport {
  const s = computeSummary(data, period)
  const itens = saidas(data, period)
  const assinaturas = itens.filter((t) => t.recurring && t.category === 'Assinaturas')
  const dups = duplicateCharges(data, period)
  const dupExtraIds = new Set(dups.flatMap((g) => g.extraIds))

  const flagged = new Map<string, number>()
  for (const t of itens) {
    const vaza = t.level === 'superfluo' || (t.recurring && t.category === 'Assinaturas') || dupExtraIds.has(t.id)
    if (vaza) flagged.set(t.id, Math.abs(t.amount))
  }

  return {
    total: [...flagged.values()].reduce((a, v) => a + v, 0),
    besteira: s?.besteira ?? 0,
    assinaturas: { total: assinaturas.reduce((a, t) => a + Math.abs(t.amount), 0), items: assinaturas },
    duplicadas: { total: dups.reduce((a, g) => a + g.amount * (g.count - 1), 0), groups: dups },
    creep: spendingCreep(data, period),
  }
}
