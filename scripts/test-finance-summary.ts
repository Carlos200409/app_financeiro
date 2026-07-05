// Self-check do cálculo. Roda: npx --yes tsx scripts/test-finance-summary.ts
import assert from 'node:assert'
import { computeSummary } from '../lib/finance-summary'
import { FinanceData, MONTHS } from '../lib/types'

const base: FinanceData = {
  transactions: [],
  installments: [],
  investments: [],
  monthlySummaries: MONTHS.map((month) => ({ month, receita: 0, fixos: 0, extras: 0, saldo: 0 })),
  importedAt: '2026-01-01T00:00:00Z',
}

const tx = (over: Record<string, unknown>) => ({
  id: 'x', date: '2026-06-15', description: 'x', amount: -10,
  category: 'Outros', level: 'util' as const, reason: '', recurring: false, ...over,
})

// 1. Holerite NÃO some quando há renda avulsa no mês (bug antigo: sumia)
{
  const s = computeSummary({
    ...base,
    holerites: [{ competencia: 'Junho/2026', tipo: 'adiantamento', empregador: '', salarioBase: 5000, bruto: 2000, descontos: 88, liquido: 1912, confianca: 'alta', addedAt: '' }],
    imports: [{ id: 'g1', source: 'Extrato', importedAt: '', transactions: [tx({ amount: 50, category: 'Renda', recurring: false })] }],
  }, '2026-06')!
  assert.equal(s.renda, 1962, `holerite + freela deviam somar 1962, veio ${s.renda}`)
  assert.equal(s.rendaFixa, 1912)
  assert.equal(s.rendaVariavel, 50)
}

// 1b. Adiantamento + fechamento da MESMA competência somam (salário total do mês)
{
  const s = computeSummary({
    ...base,
    holerites: [
      { competencia: 'Junho/2026', tipo: 'adiantamento', empregador: '', salarioBase: 5000, bruto: 2000, descontos: 88, liquido: 1912, confianca: 'alta', addedAt: '' },
      { competencia: 'Junho/2026', tipo: 'fechamento', empregador: '', salarioBase: 5000, bruto: 5000, descontos: 2900, liquido: 2100, confianca: 'alta', addedAt: '' },
    ],
  }, '2026-06')!
  assert.equal(s.renda, 4012, `adiantamento+fechamento deviam somar 4012, veio ${s.renda}`)
  assert.equal(s.rendaFixa, 4012)
}

// 2. Holerite é pulado quando JÁ existe salário (renda recorrente) no mês
{
  const s = computeSummary({
    ...base,
    holerites: [{ competencia: 'Junho/2026', tipo: 'completo', empregador: '', salarioBase: 5000, bruto: 5000, descontos: 0, liquido: 5000, confianca: 'alta', addedAt: '' }],
    imports: [{ id: 'g1', source: 'Extrato', importedAt: '', transactions: [tx({ amount: 5000, category: 'Renda', recurring: true })] }],
  }, '2026-06')!
  assert.equal(s.renda, 5000, `salário não pode contar 2x, veio ${s.renda}`)
}

// 3. Transferência positiva (pagamento de fatura) é neutra — não é renda
{
  const s = computeSummary({
    ...base,
    imports: [{ id: 'g1', source: 'Cartão', importedAt: '', transactions: [
      tx({ amount: -100, category: 'Compras' }),
      tx({ amount: 500, category: 'Transferência' }), // pagamento da fatura
    ] }],
  }, '2026-06')!
  assert.equal(s.renda, 0, `pagamento de fatura não é renda, veio ${s.renda}`)
  assert.equal(s.gastos, 100)
}

// 3b. Fatura + extrato do mesmo mês NÃO duplicam: o pagamento da fatura no
// extrato (Transferência negativa) é neutro — só as compras contam.
{
  const s = computeSummary({
    ...base,
    imports: [
      { id: 'fatura', source: 'Cartão Bradesco', importedAt: '', transactions: [
        tx({ amount: -2483, category: 'Compras' }),
      ] },
      { id: 'extrato', source: 'Extrato', importedAt: '', transactions: [
        tx({ amount: -2483, category: 'Transferência', description: 'Pagamento fatura Bradesco' }),
        tx({ amount: 5000, category: 'Renda', recurring: true, description: 'Salário' }),
      ] },
    ],
  }, '2026-06')!
  assert.equal(s.gastos, 2483, `fatura+pagamento não podem duplicar: veio ${s.gastos}`)
  assert.equal(s.renda, 5000)
}

// 4. Filtro por mês continua funcionando
{
  const s = computeSummary({
    ...base,
    imports: [{ id: 'g1', source: 'Extrato', importedAt: '', transactions: [
      tx({ date: '2026-06-10', amount: -30 }),
      tx({ date: '2026-07-10', amount: -70 }),
    ] }],
  }, '2026-06')!
  assert.equal(s.gastos, 30)
}

console.log('OK — todos os asserts do finance-summary passaram')
