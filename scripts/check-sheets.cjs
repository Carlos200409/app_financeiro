const XLSX = require('../node_modules/xlsx')
const fs = require('fs')
const buf = fs.readFileSync('../../Planilha_Controle_Financeiro_CORRIGIDA.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
console.log('Sheets:', wb.SheetNames)

// Show first few rows of first month sheet
const first = wb.SheetNames[0]
const ws = wb.Sheets[first]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
console.log('\nSheet:', first, '— primeiras 3 linhas:')
rows.slice(0,3).forEach((r, i) => console.log(i, JSON.stringify(r).slice(0,120)))
