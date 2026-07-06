// Self-check da reconciliação WhatsApp ↔ fatura. Roda: npx --yes tsx scripts/test-apply-import.ts
import assert from 'node:assert'
import { applyImport } from '../lib/apply-import'
import { FinanceData, MONTHS } from '../lib/types'

const base: FinanceData = {
  transactions: [],
  installments: [],
  investments: [],
  monthlySummaries: MONTHS.map((month) => ({ month, receita: 0, fixos: 0, extras: 0, saldo: 0 })),
  importedAt: '2026-01-01T00:00:00Z',
}

const item = (over: Record<string, unknown>) => ({
  id: 'x', date: '2026-07-05', description: 'x', amount: -10,
  category: 'Outros', level: 'util' as const, reason: '', recurring: false, ...over,
})

// Estado: 2 registros feitos pelo WhatsApp — um à vista, um parcelado 3x.
const comWhatsApp: FinanceData = {
  ...base,
  imports: [{
    id: 'wa1', source: 'WhatsApp', importedAt: '', transactions: [
      item({ id: 'wa_a', description: 'Mercado', amount: -50, date: '2026-07-03', metodo: 'pix' }),
      item({ id: 'wa_b', description: 'Tênis — Centauro', amount: -250, date: '2026-07-05', metodo: 'credito', parcelasInfo: '3x' }),
    ],
  }],
}

// 1. Fatura chega com a MESMA compra à vista (valor igual, 2 dias depois) e a
// parcela 1/3 do tênis (250/3 = 83.33) → os 2 registros do WhatsApp saem.
{
  const r = applyImport(comWhatsApp, {
    source: 'Cartão Bradesco',
    transactions: [
      item({ id: '', description: 'MERCADO BOM PRECO', amount: -50, date: '2026-07-05' }),
      item({ id: '', description: 'CENTAURO SP Parcela 1/3', amount: -83.33, date: '2026-07-06' }),
      item({ id: '', description: 'Outra compra', amount: -30, date: '2026-07-07' }),
    ],
  })
  assert.equal(r.unificados.length, 2, `deviam unificar 2, veio ${r.unificados.length} (${r.unificados})`)
  const waRestantes = r.next.imports!.filter((g) => g.source === 'WhatsApp').flatMap((g) => g.transactions)
  assert.equal(waRestantes.length, 0, 'registros do WhatsApp deviam ter saído')
  const total = r.next.imports!.flatMap((g) => g.transactions).filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)
  assert.ok(Math.abs(total - 163.33) < 0.01, `total sem duplicação devia ser 163.33, veio ${total}`)
}

// 2. Compra diferente NÃO unifica (valor distinto, sem parcela casando)
{
  const r = applyImport(comWhatsApp, {
    source: 'Cartão',
    transactions: [item({ id: '', description: 'Restaurante', amount: -80, date: '2026-07-04' })],
  })
  assert.equal(r.unificados.length, 0, 'não devia unificar nada')
}

// 3. Import do próprio WhatsApp não reconcilia contra si mesmo
{
  const r = applyImport(comWhatsApp, {
    source: 'WhatsApp',
    transactions: [item({ id: '', description: 'Padaria', amount: -12, date: '2026-07-06' })],
  })
  assert.equal(r.unificados.length, 0)
}

// 4. WhatsApp consolida num único grupo POR MÊS (não 1 grupo por mensagem).
{
  let d: FinanceData = base
  d = applyImport(d, { source: 'WhatsApp', transactions: [item({ description: 'Mercado', amount: -50, date: '2026-07-03' })] }).next
  d = applyImport(d, { source: 'WhatsApp', transactions: [item({ description: 'Uber', amount: -20, date: '2026-07-08' })] }).next
  const grupos = (d.imports ?? []).filter((g) => g.source === 'WhatsApp')
  assert.equal(grupos.length, 1, `2 msgs no mesmo mês deviam virar 1 grupo, veio ${grupos.length}`)
  assert.equal(grupos[0].transactions.length, 2, 'o grupo do mês deve ter os 2 itens')
}

// 5. Meses diferentes = grupos separados.
{
  let d: FinanceData = base
  d = applyImport(d, { source: 'WhatsApp', transactions: [item({ description: 'Jun', amount: -10, date: '2026-06-05' })] }).next
  d = applyImport(d, { source: 'WhatsApp', transactions: [item({ description: 'Jul', amount: -10, date: '2026-07-05' })] }).next
  assert.equal((d.imports ?? []).filter((g) => g.source === 'WhatsApp').length, 2, 'meses diferentes = 2 grupos')
}

console.log('OK — todos os asserts da reconciliação passaram')
