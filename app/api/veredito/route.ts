import { withClaude } from '@/lib/claude-route'

// Veredito global do mês: recebe o resumo agregado (números já calculados no
// cliente) + vereditos das faturas + contexto pessoal → devolve o veredito
// geral e 3 ações concretas. Chamado sob demanda (botão no Resumo), cacheado.

const MODEL = 'claude-sonnet-4-6'

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: {
      type: 'string',
      description: 'veredito geral do mês em 2-4 frases: fechou no verde/vermelho, por quê, e o padrão mais importante. Valores em R$.',
    },
    acoes: {
      type: 'array',
      items: { type: 'string' },
      description: 'EXATAMENTE 3 ações concretas e mensuráveis pro próximo mês (ex: "Cancela X (R$ 40/mês)", "Teto de R$ 200 em delivery", "Guarda R$ 300 no dia do pagamento")',
    },
  },
  required: ['verdict', 'acoes'],
}

const SYSTEM = `Você é um analista financeiro pessoal brasileiro, direto e honesto — como um
amigo que entende de dinheiro. Recebe o resumo do mês de uma pessoa (renda, gastos
por categoria, essencial/útil/besteira, parcelas) e os vereditos das faturas dela.

Dê o VEREDITO GERAL do mês (2-4 frases: verde ou vermelho, por quê, o padrão que
mais importa) e EXATAMENTE 3 ações concretas e mensuráveis pro próximo mês, em R$.
Se o resumo trouxer "mesAnterior", COMPARE: gastou mais ou menos que no mês
passado, e o que puxou a diferença. Se trouxer "metas" (teto por categoria),
COBRE as estouradas com o valor do estouro. Sem enrolação — clareza e número.`

export async function POST(request: Request) {
  return withClaude(request, async (client) => {
    let resumo: unknown
    let vereditosFaturas: string[] = []
    let context = ''
    try {
      const body = await request.json()
      resumo = body.resumo
      vereditosFaturas = Array.isArray(body.vereditosFaturas) ? body.vereditosFaturas.slice(0, 10) : []
      context = typeof body.context === 'string' ? body.context.slice(0, 4000) : ''
    } catch {
      return Response.json({ error: 'JSON inválido.' }, { status: 400 })
    }
    if (!resumo) return Response.json({ error: 'Resumo não enviado.' }, { status: 400 })

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `${context ? `CONTEXTO DO USUÁRIO:\n${context}\n\n` : ''}RESUMO DO MÊS:\n${JSON.stringify(resumo)}\n\nVEREDITOS DAS FATURAS:\n${vereditosFaturas.map((v) => `- ${v}`).join('\n') || '(nenhum)'}`,
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')

    return Response.json({ verdict: parsed.verdict ?? '', acoes: parsed.acoes ?? [] })
  })
}
