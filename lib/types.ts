export type MonthKey = 'JAN' | 'FEV' | 'MAR' | 'ABR' | 'MAI' | 'JUN' | 'JUL' | 'AGO' | 'SET' | 'OUT' | 'NOV' | 'DEZ'
export type Category = 'receita' | 'fixo' | 'extra'

// Período = "YYYY-MM". É a chave real de mês do app (com ano — Jan/2026 e
// Jan/2027 não colidem). MonthKey continua só em dados manuais legados.
// ponytail: lançamentos manuais antigos não têm ano; assumimos 2026 (ano em
// que foram criados). Novos lançamentos gravam `period` direto.
export const LEGACY_YEAR = '2026'

export function periodOfMonthKey(month: MonthKey, year: string): string {
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}`
}

// "2026-06" → "Junho 2026"
export function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const key = MONTHS[parseInt(m, 10) - 1]
  return key ? `${MONTH_LABELS[key]} ${y}` : period
}

export interface Transaction {
  id: string
  month: MonthKey
  period?: string // "YYYY-MM" — novos lançamentos gravam; legado assume LEGACY_YEAR
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
  parcelaId?: string // id da Installment que esta transação pagou (IA detecta)
  metodo?: string // pix | credito | debito | dinheiro | boleto (quando dá pra saber)
  parcelasInfo?: string // "3x", "8/9" — parcelamento detectado na descrição/comprovante
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
  veredito?: MonthVerdict // veredito global do mês (on-demand, cacheado)
  metas?: Record<string, number> // teto mensal por categoria (orçamento simples)
  waIds?: string[] // ids de mensagens do WhatsApp já processadas (dedupe de retry da Meta; cap 50)
}

// Veredito global de um mês: gerado sob demanda no Resumo e cacheado — só
// re-chama a IA quando o usuário pede.
export interface MonthVerdict {
  monthKey: string // mês a que se refere (ex: 'JUN')
  verdict: string
  acoes: string[] // 3 ações concretas
  geradoEm: string
}

export const MONTHS: MonthKey[] = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

export const MONTH_LABELS: Record<MonthKey, string> = {
  JAN: 'Janeiro', FEV: 'Fevereiro', MAR: 'Março', ABR: 'Abril',
  MAI: 'Maio', JUN: 'Junho', JUL: 'Julho', AGO: 'Agosto',
  SET: 'Setembro', OUT: 'Outubro', NOV: 'Novembro', DEZ: 'Dezembro',
}
