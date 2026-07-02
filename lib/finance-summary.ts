import { FinanceData, MONTHS, MonthKey } from './types'

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
  month: MonthKey | null
}

function monthFromDate(iso: string): MonthKey | null {
  const m = iso.match(/^\d{4}-(\d{2})/)
  if (!m) return null
  return MONTHS[parseInt(m[1], 10) - 1] ?? null
}

const MES_NOMES: [string, number][] = [
  ['jan', 0], ['fev', 1], ['mar', 2], ['abr', 3], ['mai', 4], ['jun', 5],
  ['jul', 6], ['ago', 7], ['set', 8], ['out', 9], ['nov', 10], ['dez', 11],
]

function monthFromCompetencia(comp: string): MonthKey | null {
  const lower = (comp ?? '').toLowerCase()
  for (const [nome, idx] of MES_NOMES) if (lower.includes(nome)) return MONTHS[idx]
  const m = lower.match(/(\d{2})\/\d{4}/)
  if (m) return MONTHS[parseInt(m[1], 10) - 1] ?? null
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
      month: (t.month as MonthKey) ?? null,
    })
  }
  for (const t of data?.analyzed ?? []) {
    entries.push({ amount: t.amount, category: t.category, level: t.level, recurring: t.recurring, month: monthFromDate(t.date) })
  }
  return entries
}

// Meses que têm qualquer dado (pro seletor saber onde há movimento).
export function monthsWithData(data: FinanceData | null): MonthKey[] {
  const set = new Set<MonthKey>()
  for (const e of buildEntries(data)) if (e.month) set.add(e.month)
  for (const h of data?.holerites ?? []) { const m = monthFromCompetencia(h.competencia); if (m) set.add(m) }
  return MONTHS.filter((m) => set.has(m))
}

export function computeSummary(data: FinanceData | null, month?: MonthKey | null): FinanceSummary | null {
  const all = buildEntries(data)
  const holerites = data?.holerites ?? []
  const hasAnything = all.length > 0 || holerites.length > 0
  if (!hasAnything) return null

  // Filtra pelo mês, se pedido.
  const entries = month ? all.filter((e) => e.month === month) : all.slice()

  // Holerite entra como renda fixa só se não houver outra renda no mesmo escopo
  // (evita contar o salário duas vezes).
  const holeriteScope = holerites
    .filter((h) => !month || monthFromCompetencia(h.competencia) === month)
    .reduce((a, h) => a + (h.liquido || 0), 0)
  const temRenda = entries.some((e) => e.amount > 0)
  if (!temRenda && holeriteScope > 0) {
    entries.push({ amount: holeriteScope, category: 'Renda', level: 'essencial', recurring: true, month: month ?? null })
  }

  if (entries.length === 0) return null

  const positives = entries.filter((e) => e.amount > 0)
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
