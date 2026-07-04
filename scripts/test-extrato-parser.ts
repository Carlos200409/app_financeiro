// Self-check do parser. Roda: npx --yes tsx scripts/test-extrato-parser.ts
import { parseAmount, parseDate, parseExtrato } from '../lib/extrato-parser'
import assert from 'node:assert'

// Números BR e US
assert.equal(parseAmount('1.234,56'), 1234.56)
assert.equal(parseAmount('-R$ 39,90'), -39.9)
assert.equal(parseAmount('1234.56'), 1234.56)
assert.equal(parseAmount('(10,00)'), -10)
assert.equal(parseAmount('-1.000.000,00'), -1000000)

// Datas
assert.equal(parseDate('31/12/2026'), '2026-12-31')
assert.equal(parseDate('2026-12-31'), '2026-12-31')
assert.equal(parseDate('20261231120000'), '2026-12-31')
assert.equal(parseDate('31/12/26'), '2026-12-31') // ano de 2 dígitos

// CSV com cabeçalho (Nubank-ish) e separador vírgula
const csv = `date,title,amount
2026-03-27,Google Youtubepremium,-26.90
2026-03-24,Giga Atacado,-400.80
2026-03-01,Salário,5000.00`
const a = parseExtrato(csv)
assert.equal(a.length, 3)
assert.equal(a[0].description, 'Google Youtubepremium')
assert.equal(a[0].amount, -26.9)
assert.equal(a[2].amount, 5000)

// CSV ponto-e-vírgula sem cabeçalho reconhecível (data;desc;valor BR)
const csv2 = `30/06/2026;Padaria;-12,50
30/06/2026;Uber;-19,90`
const b = parseExtrato(csv2)
assert.equal(b.length, 2)
assert.equal(b[1].description, 'Uber')
assert.equal(b[1].amount, -19.9)

// OFX
const ofx = `<OFX><STMTTRN><TRNAMT>-39.90</TRNAMT><DTPOSTED>20260327</DTPOSTED><MEMO>Boali - Jundiai</MEMO></STMTTRN>
<STMTTRN><TRNAMT>5000.00</TRNAMT><DTPOSTED>20260301</DTPOSTED><MEMO>Salario</MEMO></STMTTRN></OFX>`
const c = parseExtrato(ofx)
assert.equal(c.length, 2)
assert.equal(c[0].description, 'Boali - Jundiai')
assert.equal(c[0].amount, -39.9)
assert.equal(c[0].date, '2026-03-27')
assert.equal(c[1].amount, 5000)

console.log('OK — todos os asserts do parser passaram')
