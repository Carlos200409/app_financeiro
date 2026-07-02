import Anthropic from '@anthropic-ai/sdk'
import { isAuthenticated } from '@/lib/auth-guard'

// O cérebro: recebe transações cruas → Claude categoriza e julga cada uma →
// devolve categoria, nível (essencial/útil/supérfluo), motivo e insights de onde
// dá pra sobrar. A API key fica SÓ aqui no servidor (process.env), nunca no front.

// Haiku 4.5: categorização em lote é tarefa simples e de alto volume — barato e
// rápido. Trocar por 'claude-opus-4-8' se quiser julgamento mais fino.
const MODEL = 'claude-haiku-4-5'

const CATEGORIES = [
  'Alimentação', 'Supermercado', 'Transporte', 'Moradia', 'Saúde', 'Educação',
  'Lazer', 'Assinaturas', 'Compras', 'Beleza', 'Investimento', 'Renda',
  'Taxas/IOF', 'Transferência', 'Outros',
] as const

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
        },
        required: ['i', 'category', 'level', 'reason', 'recurring'],
      },
    },
    insights: {
      type: 'array',
      items: { type: 'string' },
      description: '3 a 5 frases diretas: onde está vazando dinheiro e como sobraria mais',
    },
    source: {
      type: 'string',
      description: 'origem do extrato (banco/cartão), ex "Nubank", "Cartão Bradesco". "Extrato" se não der pra saber.',
    },
  },
  required: ['items', 'insights', 'source'],
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

Depois, em "insights", aponte 3 a 5 coisas concretas: onde está vazando dinheiro,
quais gastos supérfluos somam mais, e quanto daria pra sobrar cortando. Use valores em R$.
Seja direto como um amigo que entende de dinheiro — sem enrolação.`

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: 'Faça login para usar a IA.' }, { status: 401 })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY não configurada. Adicione a chave no .env.local.' },
      { status: 500 },
    )
  }

  let transactions: RawTransaction[]
  try {
    const body = await request.json()
    transactions = body.transactions
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return Response.json({ error: 'Nenhuma transação enviada.' }, { status: 400 })
  }
  // ponytail: limite simples pra não estourar contexto/output num extrato gigante.
  // Acima disso, o cliente deve quebrar em lotes (ainda não implementado).
  if (transactions.length > 300) {
    return Response.json(
      { error: `Extrato com ${transactions.length} transações é grande demais por enquanto (máx 300). Filtre por período e tente de novo.` },
      { status: 413 },
    )
  }

  const client = new Anthropic({ apiKey })

  const list = transactions
    .map((t, i) => `${i}. ${t.date} | ${t.description} | R$ ${t.amount.toFixed(2)}`)
    .join('\n')

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        { role: 'user', content: `Classifique estas ${transactions.length} transações:\n\n${list}` },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')

    // Junta o julgamento do Claude de volta com os dados originais (por índice).
    const byIndex = new Map<number, { category: string; level: string; reason: string; recurring: boolean }>()
    for (const it of parsed.items ?? []) byIndex.set(it.i, it)

    const result = transactions.map((t, i) => ({
      ...t,
      category: byIndex.get(i)?.category ?? 'Outros',
      level: byIndex.get(i)?.level ?? 'util',
      reason: byIndex.get(i)?.reason ?? '',
      recurring: byIndex.get(i)?.recurring ?? false,
    }))

    return Response.json({ transactions: result, insights: parsed.insights ?? [], source: parsed.source || 'Extrato' })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'API key do Claude inválida. Confira o .env.local.' }, { status: 401 })
    }
    console.error('analyze error', e)
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: `Erro ao analisar: ${msg}` }, { status: 500 })
  }
}
