import { withClaude } from '@/lib/claude-route'
import { CATEGORIES } from '@/lib/types'

// Lê extrato/fatura/nota fiscal por FOTO ou PDF com Claude vision, extrai as
// transações e já categoriza — devolve o mesmo formato de /api/analyze.
// Usado quando o banco não dá CSV/OFX. A key fica só no servidor (withClaude).

// Sonnet 4.6: meio-termo — mais barato que Opus, preciso o bastante pra ler
// foto/PDF de extrato. Itens editáveis se algo vier errado.
const MODEL = 'claude-sonnet-4-6'

// Ler foto/PDF demora; o default do Vercel corta antes.
export const maxDuration = 60

const LEVELS = ['essencial', 'util', 'superfluo'] as const

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ehExtrato: { type: 'boolean', description: 'true se a imagem/PDF tem transações financeiras (extrato, fatura, recibo, nota fiscal)' },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          date: { type: 'string', description: 'data ISO YYYY-MM-DD; vazio se não houver' },
          description: { type: 'string' },
          amount: { type: 'number', description: 'negativo = saída/gasto, positivo = entrada' },
          category: { type: 'string', enum: CATEGORIES as unknown as string[] },
          level: { type: 'string', enum: LEVELS as unknown as string[] },
          reason: { type: 'string', description: 'motivo curto; numa nota fiscal, cite os itens principais aqui' },
          recurring: { type: 'boolean' },
          parcelaId: { type: 'string', description: 'se esta transação for o pagamento de uma das PARCELAS ATIVAS listadas, o id dela; senão string vazia' },
        },
        required: ['date', 'description', 'amount', 'category', 'level', 'reason', 'recurring', 'parcelaId'],
      },
    },
    verdict: { type: 'string', description: 'veredito direto sobre ESTA fatura em 2-3 frases: total, onde pesou mais, o que cortar. Valores em R$.' },
    source: { type: 'string', description: 'origem (banco/cartão) do cabeçalho, ex "Cartão Bradesco", "Nubank". "Extrato" se não achar.' },
  },
  required: ['ehExtrato', 'transactions', 'verdict', 'source'],
}

const SYSTEM = `Você lê extratos bancários, faturas de cartão, recibos e notas fiscais a partir de FOTO ou PDF.

- Extraia CADA transação: data, descrição, valor (negativo = gasto/saída, positivo = entrada).
- A imagem pode estar torta/dobrada/escura — leia mesmo assim. Não invente número que não está lá.
- Categorize cada uma: category (da lista), level (essencial/util/superfluo), recurring (repete todo mês? salário/assinatura/aluguel).
- Numa NOTA FISCAL de uma compra só: registre a compra (estabelecimento + total) e liste os itens principais no campo "reason".
- Entradas positivas = category "Renda", level "essencial".
- "Transferência" é SÓ dinheiro trocando de bolso da própria pessoa (pagamento de fatura de cartão, transferência entre contas próprias, aporte pra corretora) — neutra no cálculo. Pix/TED pagando alguém ou comprando algo é GASTO REAL: use a categoria da compra, nunca "Transferência".
- PARCELAS ATIVAS: se a mensagem listar parcelas (financiamentos) e uma transação parecer o pagamento de uma delas (boleto/financeira, valor próximo — pode vir MENOR por desconto de pontualidade, tolere ~20%), retorne o parcelaId dela. É gasto normal (ex: Transporte pra carro); o id só marca a parcela como paga.
- ⚠️ HOLERITE/CONTRACHEQUE: se a imagem for um holerite (tem salário, vencimentos e descontos tipo INSS/IRRF/FGTS), NÃO liste os descontos como gastos — eles são retidos na fonte, a pessoa NUNCA recebe nem gasta esse valor. Registre APENAS o valor LÍQUIDO como UMA entrada de Renda (amount positivo, category "Renda"). Desconto de folha nunca é saída/gasto.
- Se NÃO houver transação nenhuma (foto aleatória), retorne ehExtrato=false e transactions vazio.
- Em "verdict", o veredito desta fatura em 2-3 frases: total, onde pesou mais, o que cortar. Valores em R$.
- Se houver um bloco CONTEXTO DO USUÁRIO na mensagem, use-o: o julgamento essencial/util/superfluo é pessoal, e correções anteriores do usuário SEMPRE prevalecem.`

export async function POST(request: Request) {
  return withClaude(request, async (client) => {
    let data: string
    let mediaType: string
    let context = ''
    let installments: { id: string; description: string; value: number }[] = []
    try {
      const body = await request.json()
      data = body.data
      mediaType = body.mediaType ?? 'image/jpeg'
      context = typeof body.context === 'string' ? body.context.slice(0, 4000) : ''
      installments = Array.isArray(body.installments) ? body.installments.slice(0, 20) : []
    } catch {
      return Response.json({ error: 'Requisição inválida.' }, { status: 400 })
    }
    if (!data) return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

    const isPdf = mediaType === 'application/pdf'
    const fileBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data } }

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: `${context ? `CONTEXTO DO USUÁRIO:\n${context}\n\n` : ''}${
                installments.length
                  ? `PARCELAS ATIVAS (marque parcelaId se alguma transação for o pagamento de uma delas):\n${installments.map((p) => `- id=${p.id} | ${p.description} | R$ ${p.value.toFixed(2)}/mês`).join('\n')}\n\n`
                  : ''
              }Leia e extraia as transações no formato pedido.`,
            },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')

    if (!parsed.ehExtrato || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      return Response.json({ error: 'Não achei transações nessa imagem/PDF. Tenta uma foto mais nítida do extrato.' }, { status: 422 })
    }

    // Só aceita parcelaId que existe de verdade (a IA pode inventar).
    const validIds = new Set(installments.map((p) => p.id))
    const transactions = parsed.transactions.map((t: { parcelaId?: string }) => ({
      ...t,
      parcelaId: t.parcelaId && validIds.has(t.parcelaId) ? t.parcelaId : undefined,
    }))

    return Response.json({ transactions, verdict: parsed.verdict ?? '', source: parsed.source || 'Extrato' })
  })
}
