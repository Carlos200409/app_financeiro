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
  total: number
  installmentAmount: number
  valuePerInstallment: number
  totalInstallments: number
  status: 'ATIVO' | 'QUITADO'
  paid: number
  remaining: number
  advance: boolean
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
  investimentos: number
  saldo: number
}

export interface FinanceData {
  transactions: Transaction[]
  installments: Installment[]
  investments: Investment[]
  monthlySummaries: MonthSummary[]
  importedAt: string
}

export const MONTHS: MonthKey[] = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

export const MONTH_LABELS: Record<MonthKey, string> = {
  JAN: 'Janeiro', FEV: 'Fevereiro', MAR: 'Março', ABR: 'Abril',
  MAI: 'Maio', JUN: 'Junho', JUL: 'Julho', AGO: 'Agosto',
  SET: 'Setembro', OUT: 'Outubro', NOV: 'Novembro', DEZ: 'Dezembro',
}
