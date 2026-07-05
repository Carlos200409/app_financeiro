import { withClaude } from '@/lib/claude-route'
import { EXTRATO_FOTO_SCHEMA as SCHEMA, EXTRATO_FOTO_SYSTEM as SYSTEM } from '@/lib/ai-prompts'

// Lê extrato/fatura/nota fiscal por FOTO ou PDF com Claude vision, extrai as
// transações e já categoriza — devolve o mesmo formato de /api/analyze.
// Usado quando o banco não dá CSV/OFX. A key fica só no servidor (withClaude).

// Sonnet 4.6: meio-termo — mais barato que Opus, preciso o bastante pra ler
// foto/PDF de extrato. Itens editáveis se algo vier errado.
const MODEL = 'claude-sonnet-4-6'

// Ler foto/PDF demora; o default do Vercel corta antes.
export const maxDuration = 60

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
