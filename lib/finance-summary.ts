import { FinanceData } from './types'

// Cálculo único usado por Resumo, Gastos e Investir — mesma fonte de verdade.
// Unifica os dois mundos: lançamentos manuais (receita/fixo/extra) + transações
// analisadas pela IA (extrato/foto) + holerite. Tudo vira um "ledger" só.
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
  categorias: [string, number][] // gasto por categoria, maior primeiro
  maiorFuga?: [string, number]
  periodo: string | null
  temDados: boolean
}

interface Entry {
  amount: number // negativo = saída, positivo = entrada
  category: string
  level: string
  recurring: boolean
}

export function computeSummary(data: FinanceData | null): FinanceSummary | null {
  const analyzed = data?.analyzed ?? []
  const manual = data?.transactions ?? []
  const holerites = data?.holerites ?? []
  if (analyzed.length === 0 && manual.length === 0 && holerites.length === 0) return null

  const entries: Entry[] = []

  // Lançamentos manuais: receita = entrada; fixo/extra = saída.
  for (const t of manual) {
    const isReceita = t.category === 'receita'
    entries.push({
      amount: isReceita ? t.value : -Math.abs(t.value),
      category: isReceita ? 'Renda' : t.category === 'fixo' ? 'Fixos' : 'Extras',
      level: isReceita ? 'essencial' : 'util',
      recurring: !!t.recurring,
    })
  }

  // Transações da IA já vêm com sinal, categoria rica e nível.
  for (const t of analyzed) {
    entries.push({ amount: t.amount, category: t.category, level: t.level, recurring: t.recurring })
  }

  // Holerite entra como renda fixa APENAS se não houver receita manual — assim o
  // salário não é contado duas vezes (holerite + lançamento manual do salário).
  const temReceitaManual = manual.some((t) => t.category === 'receita')
  const temRendaIA = analyzed.some((t) => t.amount > 0)
  const holeriteLiquido = holerites.reduce((a, h) => a + (h.liquido || 0), 0)
  if (!temReceitaManual && !temRendaIA && holeriteLiquido > 0) {
    entries.push({ amount: holeriteLiquido, category: 'Renda', level: 'essencial', recurring: true })
  }

  const positives = entries.filter((e) => e.amount > 0)
  const negatives = entries.filter((e) => e.amount < 0)

  const rendaFixa = positives.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0)
  const rendaVariavel = positives.filter((e) => !e.recurring).reduce((a, e) => a + e.amount, 0)
  const renda = rendaFixa + rendaVariavel
  const gastos = negatives.reduce((a, e) => a + Math.abs(e.amount), 0)
  const sobrou = renda - gastos

  const absNivel = (lvl: string) => negatives.filter((e) => e.level === lvl).reduce((a, e) => a + Math.abs(e.amount), 0)

  const porCategoria = new Map<string, number>()
  for (const e of negatives) porCategoria.set(e.category, (porCategoria.get(e.category) ?? 0) + Math.abs(e.amount))
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])

  const datas = analyzed.map((t) => t.date).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  const periodo = datas.length ? `${br(datas[0])} – ${br(datas[datas.length - 1])}` : null

  return {
    renda,
    rendaFixa,
    rendaVariavel,
    gastos,
    sobrou,
    besteira: absNivel('superfluo'),
    essencial: absNivel('essencial'),
    util: absNivel('util'),
    assinaturas: negatives.filter((e) => e.recurring).reduce((a, e) => a + Math.abs(e.amount), 0),
    categorias,
    maiorFuga: categorias[0],
    periodo,
    temDados: entries.length > 0,
  }
}

// "2026-03-27" → "27/03"
function br(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
