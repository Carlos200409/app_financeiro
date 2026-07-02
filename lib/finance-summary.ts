import { FinanceData } from './types'

// Cálculo único usado por Resumo, Gastos e Investir — mesma fonte de verdade.
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
  temExtrato: boolean
}

export function computeSummary(data: FinanceData | null): FinanceSummary | null {
  const analyzed = data?.analyzed ?? []
  const holerites = data?.holerites ?? []
  if (analyzed.length === 0 && holerites.length === 0) return null

  const entradas = analyzed.filter((t) => t.amount > 0)
  const saidas = analyzed.filter((t) => t.amount < 0)

  const holeriteLiquido = holerites.reduce((a, h) => a + (h.liquido || 0), 0)
  const rendaFixaExtrato = entradas.filter((t) => t.recurring).reduce((a, t) => a + t.amount, 0)
  // Holerite é a fonte autoritativa da renda fixa (evita contar salário 2x).
  const rendaFixa = holerites.length > 0 ? holeriteLiquido : rendaFixaExtrato
  const rendaVariavel = entradas.filter((t) => !t.recurring).reduce((a, t) => a + t.amount, 0)
  const renda = rendaFixa + rendaVariavel

  const absNivel = (lvl: string) => saidas.filter((t) => t.level === lvl).reduce((a, t) => a + Math.abs(t.amount), 0)
  const gastos = saidas.reduce((a, t) => a + Math.abs(t.amount), 0)
  const sobrou = renda - gastos

  const porCategoria = new Map<string, number>()
  for (const t of saidas) porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + Math.abs(t.amount))
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])

  const datas = analyzed.map((t) => t.date).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  const periodo = datas.length ? `${br(datas[0])} – ${br(datas[datas.length - 1])}` : null

  return {
    renda, rendaFixa, rendaVariavel, gastos, sobrou,
    besteira: absNivel('superfluo'),
    essencial: absNivel('essencial'),
    util: absNivel('util'),
    assinaturas: saidas.filter((t) => t.recurring).reduce((a, t) => a + Math.abs(t.amount), 0),
    categorias,
    maiorFuga: categorias[0],
    periodo,
    temExtrato: analyzed.length > 0,
  }
}

// "2026-03-27" → "27/03"
function br(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
