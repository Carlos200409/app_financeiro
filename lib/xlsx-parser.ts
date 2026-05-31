import * as XLSX from 'xlsx'
import { FinanceData, Installment, Investment, MonthKey, MonthSummary, MONTHS, Transaction } from './types'

let _idCounter = 0
function uid() { return `id_${++_idCounter}_${Math.random().toString(36).slice(2,7)}` }

function parseMonthSheet(ws: XLSX.WorkSheet, month: MonthKey): {
  transactions: Transaction[]
  investimentos: number
} {
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const transactions: Transaction[] = []
  let investimentos = 0

  // rows[0] = header row, skip
  // rows[1..n] = data
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number | null)[]
    if (!row) continue

    // Detect INVESTIMENTOS summary row
    const cellA = row[0]
    if (typeof cellA === 'string' && cellA.trim().toUpperCase() === 'INVESTIMENTOS') {
      const val = row[1]
      if (typeof val === 'number') investimentos = val
    }

    // RECEITA: cols D=3, E=4, F=5
    const recDesc = row[3]
    const recVal = row[4]
    if (typeof recVal === 'number' && recVal > 0) {
      transactions.push({
        id: uid(),
        month,
        category: 'receita',
        description: typeof recDesc === 'string' && recDesc.trim() ? recDesc.trim() : 'Receita',
        value: recVal,
        date: row[5] ? String(row[5]) : undefined,
      })
    }

    // FIXOS: cols H=7, I=8, J=9
    const fixDesc = row[7]
    const fixVal = row[8]
    if (typeof fixDesc === 'string' && fixDesc.trim() && typeof fixVal === 'number' && fixVal > 0) {
      transactions.push({
        id: uid(),
        month,
        category: 'fixo',
        description: fixDesc.trim(),
        value: fixVal,
        date: row[9] ? String(row[9]) : undefined,
      })
    }

    // EXTRAS: cols L=11, M=12, N=13
    const extDesc = row[11]
    const extVal = row[12]
    if (typeof extDesc === 'string' && extDesc.trim() && typeof extVal === 'number' && extVal > 0) {
      transactions.push({
        id: uid(),
        month,
        category: 'extra',
        description: extDesc.trim(),
        value: extVal,
        date: row[13] ? String(row[13]) : undefined,
      })
    }
  }

  return { transactions, investimentos }
}

function parseInstallments(ws: XLSX.WorkSheet): Installment[] {
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const installments: Installment[] = []

  // Header is at row index 5 (row 6): DESCRIÇÃO, TOTAL, PARCELA R$, VALOR PARCELA, TOTAL PARCELAS, STATUS, PAGAS, RESTANTES, ADIANTAMENTO?
  // Data starts at row index 7 (row 8)
  for (let i = 7; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const desc = row[0]
    if (!desc || (typeof desc === 'string' && !desc.trim())) continue

    const status = typeof row[5] === 'string' ? row[5].trim().toUpperCase() : 'ATIVO'
    installments.push({
      id: uid(),
      description: typeof desc === 'string' ? desc.trim() : String(desc),
      total: typeof row[1] === 'number' ? row[1] : 0,
      installmentAmount: typeof row[2] === 'number' ? row[2] : 0,
      valuePerInstallment: typeof row[3] === 'number' ? row[3] : 0,
      totalInstallments: typeof row[4] === 'number' ? row[4] : 0,
      status: status === 'QUITADO' ? 'QUITADO' : 'ATIVO',
      paid: typeof row[6] === 'number' ? row[6] : 0,
      remaining: typeof row[7] === 'number' ? row[7] : 0,
      advance: typeof row[8] === 'string' && row[8].trim().toLowerCase() !== '' && row[8] !== null,
    })
  }

  return installments
}

function parseInvestments(ws: XLSX.WorkSheet): Investment[] {
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const categories = ['Renda Variável (Bolsa/FIIs)', 'Reserva de Emergência', 'Reserva p/ Compra à Vista', 'Renda Fixa / CDB / LCI']
  const investments: Investment[] = []

  for (const row of rows) {
    if (!row) continue
    const label = typeof row[0] === 'string' ? row[0].trim() : ''
    if (categories.some(c => label.includes(c.split('/')[0].trim()) || c.includes(label))) {
      const value = typeof row[1] === 'number' ? row[1] : 0
      investments.push({ id: uid(), category: label, value })
    }
  }

  if (investments.length === 0) {
    categories.forEach(cat => investments.push({ id: uid(), category: cat, value: 0 }))
  }

  return investments
}

export function parseXLSX(buffer: ArrayBuffer): FinanceData {
  const wb = XLSX.read(buffer, { type: 'array' })
  const transactions: Transaction[] = []
  const monthlySummaries: MonthSummary[] = []

  for (const month of MONTHS) {
    const ws = wb.Sheets[month]
    if (!ws) {
      monthlySummaries.push({ month, receita: 0, fixos: 0, extras: 0, investimentos: 0, saldo: 0 })
      continue
    }

    const { transactions: monthTx, investimentos } = parseMonthSheet(ws, month)
    transactions.push(...monthTx)

    const receita = monthTx.filter(t => t.category === 'receita').reduce((s, t) => s + t.value, 0)
    const fixos = monthTx.filter(t => t.category === 'fixo').reduce((s, t) => s + t.value, 0)
    const extras = monthTx.filter(t => t.category === 'extra').reduce((s, t) => s + t.value, 0)

    monthlySummaries.push({
      month,
      receita,
      fixos,
      extras,
      investimentos,
      saldo: receita - fixos - extras - investimentos,
    })
  }

  const installmentsWs = wb.Sheets['PARCELAS']
  const installments = installmentsWs ? parseInstallments(installmentsWs) : []

  const investmentsWs = wb.Sheets['INVESTIMENTOS']
  const investments = investmentsWs ? parseInvestments(investmentsWs) : []

  return {
    transactions,
    installments,
    investments,
    monthlySummaries,
    importedAt: new Date().toISOString(),
  }
}

export function exportToXLSX(data: FinanceData): void {
  const wb = XLSX.utils.book_new()

  // Dashboard sheet
  const dashRows = [
    ['💰 CONTROLE FINANCEIRO — EXPORTADO'],
    ['Exportado em', new Date().toLocaleString('pt-BR')],
    [],
    ['Mês', 'Receita', 'Fixos', 'Extras', 'Investimentos', 'Saldo'],
    ...data.monthlySummaries.map(s => [s.month, s.receita, s.fixos, s.extras, s.investimentos, s.saldo]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dashRows), 'RESUMO')

  // Parcelas sheet
  const parcRows = [
    ['DESCRIÇÃO', 'TOTAL', 'PARCELA R$', 'VALOR PARCELA', 'TOTAL PARCELAS', 'STATUS', 'PAGAS', 'RESTANTES', 'ADIANTAMENTO?'],
    ...data.installments.map(i => [
      i.description, i.total, i.installmentAmount, i.valuePerInstallment,
      i.totalInstallments, i.status, i.paid, i.remaining, i.advance ? 'SIM' : '',
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(parcRows), 'PARCELAS')

  // Monthly sheets
  for (const month of MONTHS) {
    const mTx = data.transactions.filter(t => t.month === month)
    const receitas = mTx.filter(t => t.category === 'receita')
    const fixos = mTx.filter(t => t.category === 'fixo')
    const extras = mTx.filter(t => t.category === 'extra')
    const maxRows = Math.max(receitas.length, fixos.length, extras.length, 1)

    const sheetRows: (string | number | null)[][] = [
      [`📅 ${month} - CONTROLE FINANCEIRO`, null, null, 'RECEITA', 'VALOR', 'DATA', null, 'FIXOS/ESSENCIAIS', 'VALOR', 'DATA', null, 'EXTRAS/LAZER', 'VALOR', 'DATA'],
    ]

    const summary = data.monthlySummaries.find(s => s.month === month)
    sheetRows.push(['RECEITA TOTAL', null, null, null, summary?.receita ?? null, null, null, fixos[0]?.description ?? null, fixos[0]?.value ?? null, null, null, extras[0]?.description ?? null, extras[0]?.value ?? null, null])
    sheetRows.push([null, null, null, receitas[0]?.description ?? null, receitas[0]?.value ?? null, receitas[0]?.date ?? null, null, null, null, null, null, null, null, null])

    for (let i = 1; i < maxRows; i++) {
      sheetRows.push([
        null, null, null,
        receitas[i]?.description ?? null, receitas[i]?.value ?? null, receitas[i]?.date ?? null,
        null,
        fixos[i]?.description ?? null, fixos[i]?.value ?? null, fixos[i]?.date ?? null,
        null,
        extras[i]?.description ?? null, extras[i]?.value ?? null, extras[i]?.date ?? null,
      ])
    }

    sheetRows.push(['INVESTIMENTOS', summary?.investimentos ?? 0])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetRows), month)
  }

  XLSX.writeFile(wb, 'Planilha_Controle_Financeiro_EXPORTADA.xlsx')
}
