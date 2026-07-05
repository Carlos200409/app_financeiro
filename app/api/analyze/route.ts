import { withClaude } from '@/lib/claude-route'
import { CATEGORIES } from '@/lib/types'

// O cérebro: recebe transações cruas (+ contexto pessoal do usuário) → Claude
// categoriza e julga cada uma → devolve categoria, nível, motivo e o veredito
// da fatura. A API key fica SÓ no servidor (via withClaude), nunca no front.

// Sonnet 4.6: mesmo modelo das leituras de foto (consistência). Categorização de
// texto é leve, então o custo segue baixo (centavos). Trocar por 'claude-haiku-4-5'
// pra ficar ainda mais barato, ou 'claude-opus-4-8' pra julgamento mais fino.
const MODEL = 'claude-sonnet-4-6'

// Análise de extrato grande demora; o default do Vercel corta antes.
export const maxDuration = 60

const LEVELS = ['essencial', 'util', 'superfluo'] as const

interface RawTransaction {
  date: string
  description: string
  amount: number
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          i: { type: 'integer', description: 'índice da transação no array de entrada' },
          category: { type: 'string', enum: CATEGORIES as unknown as string[] },
          level: { type: 'string', enum: LEVELS as unknown as string[] },
          reason: { type: 'string', description: 'motivo curto (máx ~12 palavras)' },
          recurring: { type: 'boolean', description: 'true se parece cobrança/renda que se repete todo mês (salário, assinatura, aluguel, mensalidade)' },
          parcelaId: { type: 'string', description: 'se esta transação for o pagamento de uma das PARCELAS ATIVAS listadas na mensagem, o id dela; senão string vazia' },
        },
        required: ['i', 'category', 'level', 'reason', 'recurring', 'parcelaId'],
      },
    },
    verdict: {
      type: 'string',
      description: 'veredito direto sobre ESTA fatura em 2-3 frases: total gasto, onde pesou mais, o que cortar e quanto sobraria. Valores em R$.',
    },
    source: {
      type: 'string',
      description: 'origem do extrato (banco/cartão), ex "Nubank", "Cartão Bradesco". "Extrato" se não der pra saber.',
    },
    cartaoCredito: {
      type: 'boolean',
      description: 'true se isto parece FATURA DE CARTÃO onde as COMPRAS aparecem com valor POSITIVO (convenção invertida, ex: CSV do cartão Nubank)',
    },
  },
  required: ['items', 'verdict', 'source', 'cartaoCredito'],
}

const SYSTEM = `Você é um analista financeiro pessoal brasileiro, direto e honesto.
Recebe transações de um extrato bancário/cartão e classifica CADA uma.

Para cada transação devolva:
- category: uma das categorias permitidas
- level: "essencial" (precisava mesmo), "util" (ajuda mas dá pra cortar), "superfluo" (besteira, dava pra economizar)
- reason: motivo curto e honesto
- recurring: true se parece cobrança/renda que se repete todo mês (salário, aluguel, mensalidade, assinatura tipo Netflix/Spotify/academia). false se é gasto avulso.

Entradas de dinheiro (valor positivo) são category "Renda" e level "essencial".
Salário (recorrente) é recurring=true; renda avulsa/variável (corrida, freela, venda) é recurring=false.

PARCELAS ATIVAS: se a mensagem listar parcelas ativas (financiamentos etc.) e uma
transação parecer o pagamento de uma delas (descrição de boleto/financeira e valor
próximo — pode vir MENOR por desconto de pontualidade, tolere ~20%), retorne o
parcelaId dela nessa transação. É gasto normal (categoria da compra, ex Transporte
pra carro) — o id só serve pra marcar a parcela como paga.

"Transferência" é SÓ dinheiro trocando de bolso da própria pessoa: pagamento de
fatura de cartão, transferência entre contas próprias, aporte pra corretora.
(Essas são neutras no cálculo — não contam como renda nem gasto.)
Pix/TED PAGANDO alguém ou comprando algo é GASTO REAL: use a categoria da compra
(Alimentação, Transporte...), nunca "Transferência".

ATENÇÃO — FATURA DE CARTÃO: alguns exports de cartão (ex: CSV do cartão Nubank) listam
COMPRAS com valor POSITIVO e pagamento/estorno negativo. Se a lista parecer isso
(maioria positiva, descrições de compras em estabelecimentos), retorne cartaoCredito=true
e categorize as compras normalmente (NÃO como Renda). Pagamento de fatura é "Transferência".
Se for extrato normal (gastos negativos), cartaoCredito=false.

Depois, em "verdict", dê o veredito desta fatura em 2-3 frases: total, onde pesou
mais, o que cortar e quanto sobraria. Direto como um amigo que entende de dinheiro.

Se houver um bloco CONTEXTO DO USUÁRIO na mensagem, use-o: o julgamento
essencial/util/superfluo é pessoal (ex: quem trabalha com carro tem combustível
essencial), e correções anteriores do usuário SEMPRE prevalecem.`

export async function POST(request: Request) {
  return withClaude(request, async (client) => {
    let transactions: RawTransaction[]
    let context = ''
    let installments: { id: string; description: string; value: number }[] = []
    try {
      const body = await request.json()
      transactions = body.transactions
      context = typeof body.context === 'string' ? body.context.slice(0, 4000) : ''
      installments = Array.isArray(body.installments) ? body.installments.slice(0, 20) : []
    } catch {
      return Response.json({ error: 'JSON inválido.' }, { status: 400 })
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return Response.json({ error: 'Nenhuma transação enviada.' }, { status: 400 })
    }
    // ponytail: teto de 150 — acima disso o output encosta no max_tokens (JSON
    // truncado → análise perdida) e no timeout do Vercel. Lotes ficam pro futuro.
    if (transactions.length > 150) {
      return Response.json(
        { error: `Extrato com ${transactions.length} transações é grande demais por enquanto (máx 150). Exporta um período menor (ex: 1 mês) e tenta de novo.` },
        { status: 413 },
      )
    }

    const list = transactions
      .map((t, i) => `${i}. ${t.date} | ${t.description} | R$ ${t.amount.toFixed(2)}`)
      .join('\n')

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `${context ? `CONTEXTO DO USUÁRIO:\n${context}\n\n` : ''}${
            installments.length
              ? `PARCELAS ATIVAS (marque parcelaId se alguma transação for o pagamento de uma delas):\n${installments.map((p) => `- id=${p.id} | ${p.description} | R$ ${p.value.toFixed(2)}/mês`).join('\n')}\n\n`
              : ''
          }Classifique estas ${transactions.length} transações:\n\n${list}`,
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')

    // Junta o julgamento do Claude de volta com os dados originais (por índice).
    const byIndex = new Map<number, { category: string; level: string; reason: string; recurring: boolean; parcelaId?: string }>()
    for (const it of parsed.items ?? []) byIndex.set(it.i, it)
    const validIds = new Set(installments.map((p) => p.id))

    // Fatura de cartão com convenção invertida: compra positiva vira gasto
    // (negativo); linha negativa (pagamento/estorno) vira positiva — e como o
    // pagamento é "Transferência", o cálculo trata como neutro, não renda.
    const cartao = parsed.cartaoCredito === true
    const result = transactions.map((t, i) => ({
      ...t,
      amount: cartao ? -t.amount : t.amount,
      category: byIndex.get(i)?.category ?? 'Outros',
      level: byIndex.get(i)?.level ?? 'util',
      reason: byIndex.get(i)?.reason ?? '',
      recurring: byIndex.get(i)?.recurring ?? false,
      parcelaId: validIds.has(byIndex.get(i)?.parcelaId ?? '') ? byIndex.get(i)!.parcelaId : undefined,
    }))

    return Response.json({ transactions: result, verdict: parsed.verdict ?? '', source: parsed.source || 'Extrato' })
  })
}
