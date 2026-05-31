import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = join(__dirname, '../../Planilha_Controle_Financeiro_CORRIGIDA.xlsx')
const OUT_PATH  = join(__dirname, '../lib/initial-data.json')

const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

let _id = 0
function uid() { return `id_${++_id}_${Math.random().toString(36).slice(2,7)}` }

function parseMonthSheet(ws, month) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const transactions = []
  let investimentos = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const cellA = row[0]
    if (typeof cellA === 'string' && cellA.trim().toUpperCase() === 'INVESTIMENTOS') {
      const val = row[1]
      if (typeof val === 'number') investimentos = val
    }

    const recDesc = row[3], recVal = row[4]
    if (typeof recVal === 'number' && recVal > 0) {
      transactions.push({ id: uid(), month, category: 'receita',
        description: typeof recDesc === 'string' && recDesc.trim() ? recDesc.trim() : 'Receita',
        value: recVal, date: row[5] ? String(row[5]) : undefined })
    }

    const fixDesc = row[7], fixVal = row[8]
    if (typeof fixDesc === 'string' && fixDesc.trim() && typeof fixVal === 'number' && fixVal > 0) {
      transactions.push({ id: uid(), month, category: 'fixo',
        description: fixDesc.trim(), value: fixVal,
        date: row[9] ? String(row[9]) : undefined })
    }

    const extDesc = row[11], extVal = row[12]
    if (typeof extDesc === 'string' && extDesc.trim() && typeof extVal === 'number' && extVal > 0) {
      transactions.push({ id: uid(), month, category: 'extra',
        description: extDesc.trim(), value: extVal,
        date: row[13] ? String(row[13]) : undefined })
    }
  }
  return { transactions, investimentos }
}

function parseInstallments(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const installments = []
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
      advance: typeof row[8] === 'string' && row[8].trim() !== '',
    })
  }
  return installments
}

function parseInvestments(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const categories = ['Renda Variável (Bolsa/FIIs)', 'Reserva de Emergência', 'Reserva p/ Compra à Vista', 'Renda Fixa / CDB / LCI']
  const investments = []
  for (const row of rows) {
    if (!row) continue
    const label = typeof row[0] === 'string' ? row[0].trim() : ''
    if (categories.some(c => label.includes(c.split('/')[0].trim()) || c.includes(label))) {
      investments.push({ id: uid(), category: label, value: typeof row[1] === 'number' ? row[1] : 0 })
    }
  }
  if (investments.length === 0) {
    categories.forEach(cat => investments.push({ id: uid(), category: cat, value: 0 }))
  }
  return investments
}

// ── Main ─────────────────────────────────────────────────────────────────────
const buffer = readFileSync(XLSX_PATH)
const wb = XLSX.read(buffer, { type: 'buffer' })

const transactions = []
const monthlySummaries = []

for (const month of MONTHS) {
  const ws = wb.Sheets[month]
  if (!ws) {
    monthlySummaries.push({ month, receita: 0, fixos: 0, extras: 0, investimentos: 0, saldo: 0 })
    continue
  }
  const { transactions: monthTx, investimentos } = parseMonthSheet(ws, month)
  transactions.push(...monthTx)
  const receita = monthTx.filter(t => t.category === 'receita').reduce((s, t) => s + t.value, 0)
  const fixos   = monthTx.filter(t => t.category === 'fixo'   ).reduce((s, t) => s + t.value, 0)
  const extras  = monthTx.filter(t => t.category === 'extra'  ).reduce((s, t) => s + t.value, 0)
  monthlySummaries.push({ month, receita, fixos, extras, investimentos, saldo: receita - fixos - extras - investimentos })
}

const installments = wb.Sheets['PARCELAS']   ? parseInstallments(wb.Sheets['PARCELAS'])   : []
const investments  = wb.Sheets['INVESTIMENTOS'] ? parseInvestments(wb.Sheets['INVESTIMENTOS']) : []

const data = { transactions, installments, investments, monthlySummaries, importedAt: new Date().toISOString() }

writeFileSync(OUT_PATH, JSON.stringify(data, null, 2))
console.log(`✅ initial-data.json gerado: ${transactions.length} transações, ${installments.length} parcelas, ${investments.length} investimentos`)
