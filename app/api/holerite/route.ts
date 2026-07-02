import Anthropic from '@anthropic-ai/sdk'

// Lê holerite por foto com Claude vision. Devolve estruturado: competência,
// tipo (adiantamento/fechamento), bruto, descontos, líquido. A key fica só aqui
// no servidor. 1 foto por mês → custo em centavos.

// Haiku 4.5 tem visão e é barato. Se a leitura vier imprecisa em fotos ruins
// (torta, dobrada, escura), trocar por 'claude-opus-4-8' — mais caro, mais preciso.
const MODEL = 'claude-haiku-4-5'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ehHolerite: { type: 'boolean', description: 'true só se a imagem for mesmo um holerite/contracheque/recibo de pagamento' },
    competencia: { type: 'string', description: 'mês/ano de referência, ex "Junho/2026". Vazio se não achar.' },
    tipo: { type: 'string', enum: ['adiantamento', 'fechamento', 'completo', 'outro'], description: 'adiantamento (parte do salário), fechamento (o resto), completo (salário inteiro num recibo só), ou outro' },
    empregador: { type: 'string', description: 'nome da empresa/empregador. Vazio se não achar.' },
    salarioBase: { type: 'number', description: 'salário base cheio, se aparecer. 0 se não achar.' },
    bruto: { type: 'number', description: 'total de vencimentos DESTE recibo' },
    descontos: { type: 'number', description: 'total de descontos DESTE recibo' },
    liquido: { type: 'number', description: 'valor líquido recebido neste recibo' },
    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'], description: 'quão confiante você está na leitura' },
  },
  required: ['ehHolerite', 'competencia', 'tipo', 'empregador', 'salarioBase', 'bruto', 'descontos', 'liquido', 'confianca'],
}

const SYSTEM = `Você lê holerites (contracheques) brasileiros a partir de uma foto e extrai os números.

Regras:
- A foto pode estar torta, dobrada ou girada. Leia mesmo assim.
- Entenda a ESTRUTURA, não faça OCR cego:
  - "tipo": se o recibo diz "Adiantamento", é tipo "adiantamento" (é só uma parte do salário do mês). Se é o fechamento/2ª parcela, "fechamento". Se é o salário inteiro num recibo só, "completo".
  - "bruto" = total de vencimentos DESTE recibo (não o salário base).
  - "liquido" = o valor que a pessoa efetivamente recebeu neste recibo.
  - "salarioBase" = o salário cheio, se estiver escrito (mesmo que este recibo seja só um adiantamento).
- Se NÃO for um holerite (extrato, nota fiscal, foto qualquer), retorne ehHolerite=false e zere os números.
- Números em reais, use ponto decimal (2000.00, não "2.000,00").`

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }

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

  const client = new Anthropic({ apiKey })

  try {
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
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'API key do Claude inválida.' }, { status: 401 })
    }
    console.error('holerite error', e)
    return Response.json({ error: 'Erro ao ler o holerite. Tenta de novo.' }, { status: 500 })
  }
}
