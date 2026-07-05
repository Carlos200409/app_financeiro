export type MonthKey = 'JAN' | 'FEV' | 'MAR' | 'ABR' | 'MAI' | 'JUN' | 'JUL' | 'AGO' | 'SET' | 'OUT' | 'NOV' | 'DEZ'
export type Category = 'receita' | 'fixo' | 'extra'

export interface Transaction {
  id: string
  month: MonthKey
  category: Category
  description: string
  value: number
  date?: string
  recurring?: boolean
}

export interface Installment {
  id: string
  description: string
  valuePerInstallment: number
  totalInstallments: number
  status: 'ATIVO' | 'QUITADO'
  paid: number
  remaining: number
}

export interface Investment {
  id: string
  category: string
  value: number
}

export interface MonthSummary {
  month: MonthKey
  receita: number
  fixos: number
  extras: number
  saldo: number
}

export type SpendingLevel = 'essencial' | 'util' | 'superfluo'

// Categorias da IA — fonte única (rotas /api e telas importam daqui).
export const CATEGORIES = [
  'Alimentação', 'Supermercado', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Assinaturas', 'Compras', 'Beleza', 'Investimento', 'Renda',
  'Taxas/IOF', 'Transferência', 'Outros',
] as const

export const LEVEL_META: Record<SpendingLevel, { label: string; color: string }> = {
  essencial: { label: 'Essencial', color: '#4ade80' },
  util: { label: 'Útil', color: '#fbbf24' },
  superfluo: { label: 'Besteira', color: '#f87171' },
}

// Transação de extrato categorizada pela IA. Editável pelo usuário.
export interface AnalyzedTransaction {
  id: string
  date: string // ISO YYYY-MM-DD quando dá; senão texto original
  description: string
  amount: number // negativo = saída, positivo = entrada
  category: string // categoria da IA (Alimentação, Transporte, Renda, ...)
  level: SpendingLevel
  reason: string
  recurring: boolean // cobrança/renda mensal recorrente (salário, assinatura, aluguel)
}

// Um extrato/fatura importado = um grupo com itens. Ex: "Cartão Bradesco".
// A IA monta o rascunho; o usuário edita nome/valor/categoria de cada item.
export interface ImportGroup {
  id: string
  source: string // "Cartão Bradesco", "Nubank", "Extrato", ...
  importedAt: string
  transactions: AnalyzedTransaction[]
  verdict?: string // veredito da IA sobre ESTA fatura (2-3 frases)
}

// Correção feita pelo usuário numa categorização da IA — vira exemplo nas
// próximas análises (a IA aprende com você).
export interface Correction {
  description: string
  category: string
  level: SpendingLevel
}

// Holerite lido por foto (Claude vision). Vira renda fixa no Resumo.
export interface Holerite {
  competencia: string // "Junho/2026" ou "06/2026"
  tipo: string // adiantamento | fechamento | completo | outro
  empregador: string
  salarioBase: number
  bruto: number // total de vencimentos deste recibo
  descontos: number
  liquido: number // valor líquido recebido
  confianca: string // alta | media | baixa
  addedAt: string // ISO
}

export interface FinanceData {
  transactions: Transaction[]
  installments: Installment[]
  investments: Investment[]
  monthlySummaries: MonthSummary[]
  importedAt: string
  imports?: ImportGroup[] // extratos/faturas importados, agrupados e editáveis
  holerites?: Holerite[] // holerites lidos por foto (renda fixa)
  sobreMim?: string // contexto pessoal que o usuário escreve pra IA julgar melhor
  correcoes?: Correction[] // últimas correções do usuário (a IA aprende; cap 50)
}

export const MONTHS: MonthKey[] = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

export const MONTH_LABELS: Record<MonthKey, string> = {
  JAN: 'Janeiro', FEV: 'Fevereiro', MAR: 'Março', ABR: 'Abril',
  MAI: 'Maio', JUN: 'Junho', JUL: 'Julho', AGO: 'Agosto',
  SET: 'Setembro', OUT: 'Outubro', NOV: 'Novembro', DEZ: 'Dezembro',
}
