import { FinanceData, LEGACY_YEAR, periodOfMonthKey } from './types'

// Cálculo único usado por Resumo, Gastos e Investir — mesma fonte de verdade.
// Unifica lançamentos manuais + IA + holerite num "ledger", e pode filtrar por mês.
export interface FinanceSummary {
  renda: number
  rendaFixa: number
  rendaVariavel: number
  gastos: number
  sobrou: number
  besteira: number
  essencial: number
  util: number
  assinaturas: number
  categorias: [string, number][]
  maiorFuga?: [string, number]
  periodo: string | null
  temDados: boolean
}

interface Entry {
  amount: number
  category: string
  level: string
  recurring: boolean
  period: string | null // "YYYY-MM"
}

function periodFromDate(iso: string): string | null {
  return iso.match(/^\d{4}-\d{2}/)?.[0] ?? null
}

const MES_NOMES: [string, number][] = [
  ['jan', 0], ['fev', 1], ['mar', 2], ['abr', 3], ['mai', 4], ['jun', 5],
  ['jul', 6], ['ago', 7], ['set', 8], ['out', 9], ['nov', 10], ['dez', 11],
]

// "Junho/2026" ou "06/2026" → "2026-06". Sem ano, assume LEGACY_YEAR.
function periodFromCompetencia(comp: string): string | null {
  const lower = (comp ?? '').toLowerCase()
  const ano = lower.match(/(20\d{2})/)?.[1] ?? LEGACY_YEAR
  for (const [nome, idx] of MES_NOMES) if (lower.includes(nome)) return `${ano}-${String(idx + 1).padStart(2, '0')}`
  const m = lower.match(/(\d{2})\/20\d{2}/)
  if (m) return `${ano}-${m[1]}`
  return null
}

function buildEntries(data: FinanceData | null): Entry[] {
  const entries: Entry[] = []
  for (const t of data?.transactions ?? []) {
    const isReceita = t.category === 'receita'
    entries.push({
      amount: isReceita ? t.value : -Math.abs(t.value),
      category: isReceita ? 'Renda' : t.category === 'fixo' ? 'Fixos' : 'Extras',
      level: isReceita ? 'essencial' : 'util',
      recurring: !!t.recurring,
      // Novos lançamentos têm period; legado assume LEGACY_YEAR pelo month.
      period: t.period ?? (t.month ? periodOfMonthKey(t.month, LEGACY_YEAR) : null),
    })
  }
  const analisadas = (data?.imports ?? []).flatMap((g) => g.transactions)
  for (const t of analisadas) {
    entries.push({ amount: t.amount, category: t.category, level: t.level, recurring: t.recurring, period: periodFromDate(t.date) })
  }
  return entries
}

// Períodos (YYYY-MM) que têm qualquer dado, ordenados (pro seletor).
export function periodsWithData(data: FinanceData | null): string[] {
  const set = new Set<string>()
  for (const e of buildEntries(data)) if (e.period) set.add(e.period)
  for (const h of data?.holerites ?? []) { const p = periodFromCompetencia(h.competencia); if (p) set.add(p) }
  return [...set].sort()
}

export function computeSummary(data: FinanceData | null, period?: string | null): FinanceSummary | null {
  const all = buildEntries(data)
  const holerites = data?.holerites ?? []
  const hasAnything = all.length > 0 || holerites.length > 0
  if (!hasAnything) return null

  // Filtra pelo período (YYYY-MM), se pedido.
  const entries = period ? all.filter((e) => e.period === period) : all.slice()

  // Holerite entra como renda fixa a menos que já exista SALÁRIO (renda
  // recorrente) no escopo — evita contar 2x sem apagar o holerite quando entra
  // um Pix/freela avulso no mês.
  const holeriteScope = holerites
    .filter((h) => !period || periodFromCompetencia(h.competencia) === period)
    .reduce((a, h) => a + (h.liquido || 0), 0)
  const temSalario = entries.some((e) => e.amount > 0 && e.recurring)
  if (!temSalario && holeriteScope > 0) {
    entries.push({ amount: holeriteScope, category: 'Renda', level: 'essencial', recurring: true, period: period ?? null })
  }

  if (entries.length === 0) return null

  // Transferência positiva (ex: pagamento de fatura do cartão) não é renda —
  // é dinheiro trocando de bolso. Fica neutra (nem renda, nem gasto).
  const positives = entries.filter((e) => e.amount > 0 && e.category !== 'Transferência')
  const negatives = entries.filter((e) => e.amount < 0)

  const rendaFixa = positives.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0)
  const rendaVariavel = positives.filter((e) => !e.recurring).reduce((a, e) => a + e.amount, 0)
  const renda = rendaFixa + rendaVariavel
  const gastos = negatives.reduce((a, e) => a + Math.abs(e.amount), 0)

  const absNivel = (lvl: string) => negatives.filter((e) => e.level === lvl).reduce((a, e) => a + Math.abs(e.amount), 0)
  const porCategoria = new Map<string, number>()
  for (const e of negatives) porCategoria.set(e.category, (porCategoria.get(e.category) ?? 0) + Math.abs(e.amount))
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])

  return {
    renda,
    rendaFixa,
    rendaVariavel,
    gastos,
    sobrou: renda - gastos,
    besteira: absNivel('superfluo'),
    essencial: absNivel('essencial'),
    util: absNivel('util'),
    assinaturas: negatives.filter((e) => e.recurring).reduce((a, e) => a + Math.abs(e.amount), 0),
    categorias,
    maiorFuga: categorias[0],
    periodo: null,
    temDados: entries.length > 0,
  }
}
