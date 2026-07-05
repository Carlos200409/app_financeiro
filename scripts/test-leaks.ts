// Self-check do caça-vazamento. Roda: npx --yes tsx scripts/test-leaks.ts
import assert from 'node:assert'
import { estimatedLeak, duplicateCharges, spendingCreep, recurringCharges } from '../lib/leaks'
import { AnalyzedTransaction, FinanceData, MONTHS } from '../lib/types'

const base: FinanceData = {
  transactions: [], installments: [], investments: [],
  monthlySummaries: MONTHS.map((month) => ({ month, receita: 0, fixos: 0, extras: 0, saldo: 0 })),
  importedAt: '2026-01-01T00:00:00Z',
}

function tx(over: Partial<AnalyzedTransaction>): AnalyzedTransaction {
  return { id: Math.random().toString(36).slice(2), date: '2026-07-05', description: 'x', amount: -10,
    category: 'Outros', level: 'util', reason: '', recurring: false, ...over }
}

function withItems(items: AnalyzedTransaction[]): FinanceData {
  return { ...base, imports: [{ id: 'g', source: 'Cartão', importedAt: '', transactions: items }] }
}

// 1. Cobrança duplicada (mesma descrição + valor, 2 dias depois) é detectada.
{
  const data = withItems([
    tx({ description: 'NETFLIX', amount: -39.9, date: '2026-07-03' }),
    tx({ description: 'NETFLIX', amount: -39.9, date: '2026-07-05' }),
  ])
  const dups = duplicateCharges(data, '2026-07')
  assert.equal(dups.length, 1, 'devia achar 1 grupo duplicado')
  assert.equal(dups[0].count, 2)
  assert.equal(dups[0].extraIds.length, 1, 'a 2ª cobrança é o desperdício')
}

// 2. Cobrança repetida FORA da janela (30 dias) NÃO é duplicata (é recorrência normal).
{
  const data = withItems([
    tx({ description: 'ACADEMIA', amount: -100, date: '2026-07-01' }),
    tx({ description: 'ACADEMIA', amount: -100, date: '2026-07-31' }),
  ])
  assert.equal(duplicateCharges(data, '2026-07').length, 0, 'mensal ≠ duplicata')
}

// 3. Total do vazamento = superfluo + assinatura, SEM dupla contagem.
{
  const data = withItems([
    tx({ description: 'Bar', amount: -80, level: 'superfluo' }),                                   // 80 besteira
    tx({ description: 'Spotify', amount: -20, level: 'superfluo', recurring: true, category: 'Assinaturas' }), // superfluo E assinatura → conta 1x (20)
    tx({ description: 'Aluguel', amount: -1500, level: 'essencial', recurring: true, category: 'Moradia' }),   // recorrente essencial → NÃO vaza
    tx({ description: 'Mercado', amount: -200, level: 'essencial' }),                              // essencial → não vaza
  ])
  const r = estimatedLeak(data, '2026-07')
  assert.equal(r.total, 100, `total devia ser 80+20=100, veio ${r.total}`)
  assert.equal(r.assinaturas.total, 20, 'assinatura = Spotify 20')
  assert.equal(r.besteira, 100, 'superfluo = 80+20')
}

// 4. Transferência (pagamento de fatura) é ignorada — não é vazamento.
{
  const data = withItems([
    tx({ description: 'PAGTO FATURA', amount: -2000, category: 'Transferência', level: 'essencial' }),
    tx({ description: 'iFood', amount: -50, level: 'superfluo' }),
  ])
  assert.equal(estimatedLeak(data, '2026-07').total, 50, 'só o iFood vaza')
}

// 5. Creep: categoria que subiu >30% vs mês anterior aparece.
{
  const data = withItems([
    tx({ description: 'iFood jun', amount: -100, category: 'Alimentação', date: '2026-06-10' }),
    tx({ description: 'iFood jul', amount: -180, category: 'Alimentação', date: '2026-07-10' }),
  ])
  const creep = spendingCreep(data, '2026-07')
  assert.equal(creep.length, 1, 'Alimentação subiu 80%')
  assert.equal(creep[0].category, 'Alimentação')
  assert.ok(Math.abs(creep[0].deltaPct - 0.8) < 0.001, `delta devia ser 0.8, veio ${creep[0].deltaPct}`)
}

// 6. recurringCharges filtra por período e pega só recorrentes.
{
  const data = withItems([
    tx({ description: 'Spotify', amount: -20, recurring: true, date: '2026-07-01' }),
    tx({ description: 'Spotify jun', amount: -20, recurring: true, date: '2026-06-01' }),
    tx({ description: 'Padaria', amount: -8, recurring: false, date: '2026-07-02' }),
  ])
  assert.equal(recurringCharges(data, '2026-07').length, 1, 'só 1 recorrente em julho')
  assert.equal(recurringCharges(data).length, 2, 'sem período = todos os recorrentes')
}

console.log('OK — todos os asserts do caça-vazamento passaram')
