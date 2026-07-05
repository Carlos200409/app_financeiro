import { withClaude } from '@/lib/claude-route'
import { HOLERITE_SCHEMA as SCHEMA, HOLERITE_SYSTEM as SYSTEM } from '@/lib/ai-prompts'

// Lê holerite por foto com Claude vision. Devolve estruturado: competência,
// tipo (adiantamento/fechamento), bruto, descontos, líquido. A key fica só no
// servidor (withClaude). 1 foto por mês → custo em centavos.

// Sonnet 4.6: meio-termo — bem mais barato que Opus e muito mais preciso que
// Haiku (que alucinava em foto torta). Se algum holerite vier errado, o usuário
// edita (dados são editáveis) ou sobe pra 'claude-opus-4-8'.
const MODEL = 'claude-sonnet-4-6'

// Leitura por visão demora; o default do Vercel corta antes.
export const maxDuration = 60

export async function POST(request: Request) {
  return withClaude(request, async (client) => {
    let image: string
    let mediaType: string
    try {
      const body = await request.json()
      image = body.image // base64 sem o prefixo data:
      mediaType = body.mediaType ?? 'image/jpeg'
    } catch {
      return Response.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    if (!image) {
      return Response.json({ error: 'Nenhuma imagem enviada.' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: image },
            },
            { type: 'text', text: 'Leia este holerite e extraia os dados no formato pedido.' },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')

    if (!parsed.ehHolerite) {
      return Response.json({ error: 'Isso não parece um holerite. Tenta uma foto mais nítida do contracheque.' }, { status: 422 })
    }

    return Response.json({ holerite: parsed })
  })
}
