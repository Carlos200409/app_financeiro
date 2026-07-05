import { processMessage } from '@/lib/ingest-core'

// Webhook oficial da Meta (WhatsApp Cloud API, número de teste — sem CNPJ).
// Você manda foto/texto do SEU WhatsApp pro número de teste → a Meta chama
// esta rota → IA registra → respondemos no chat via Graph API.
//
// Envs (Vercel): WHATSAPP_TOKEN (token de acesso), WHATSAPP_VERIFY_TOKEN
// (string que você escolhe e repete no painel da Meta), WHATSAPP_ALLOWED_NUMBER
// (seu número, só dígitos com DDI, ex 554799999999).

export const maxDuration = 60

const GRAPH = 'https://graph.facebook.com/v20.0'

// Verificação do webhook (a Meta chama GET uma vez ao configurar).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}

async function downloadMedia(mediaId: string, token: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
    if (!meta?.url) return null
    const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!bin.ok) return null
    const buf = Buffer.from(await bin.arrayBuffer())
    return { base64: buf.toString('base64'), mediaType: meta.mime_type || 'image/jpeg' }
  } catch {
    return null
  }
}

async function reply(phoneNumberId: string, to: string, body: string, token: string) {
  try {
    await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    })
  } catch (e) {
    console.error('whatsapp reply error', e)
  }
}

export async function POST(request: Request) {
  const token = process.env.WHATSAPP_TOKEN
  const allowed = (process.env.WHATSAPP_ALLOWED_NUMBER ?? '').replace(/\D/g, '')
  // Sempre 200 pra Meta não desativar o webhook; erros vão pro log.
  const ok = () => Response.json({ status: 'ok' })
  if (!token || !allowed) {
    console.error('whatsapp: faltam WHATSAPP_TOKEN/WHATSAPP_ALLOWED_NUMBER')
    return ok()
  }

  let payload: {
    entry?: { changes?: { value?: {
      metadata?: { phone_number_id?: string }
      messages?: {
        id?: string; from?: string; type?: string
        text?: { body?: string }
        image?: { id?: string; caption?: string }
        document?: { id?: string; caption?: string; mime_type?: string }
      }[]
    } }[] }[]
  }
  try {
    payload = await request.json()
  } catch {
    return ok()
  }

  const value = payload.entry?.[0]?.changes?.[0]?.value
  const msg = value?.messages?.[0]
  const phoneNumberId = value?.metadata?.phone_number_id
  if (!msg || !phoneNumberId) return ok() // status de entrega etc — ignora

  const from = (msg.from ?? '').replace(/\D/g, '')
  // Allowlist: SÓ o dono registra gastos (compara os últimos 11 dígitos —
  // números BR às vezes vêm com/sem o 9 extra).
  if (!from || (from.slice(-11) !== allowed.slice(-11) && from !== allowed)) {
    console.warn('whatsapp: mensagem de número não autorizado', from)
    return ok()
  }

  let resumo = ''
  if (msg.type === 'text' && msg.text?.body) {
    const r = await processMessage({ kind: 'texto', text: msg.text.body, dedupeId: msg.id })
    resumo = r.resumo
  } else if (msg.type === 'image' && msg.image?.id) {
    const media = await downloadMedia(msg.image.id, token)
    if (!media) {
      resumo = '❌ Não consegui baixar a imagem. Tenta mandar de novo.'
    } else {
      const r = await processMessage({
        kind: 'imagem',
        mediaBase64: media.base64,
        mediaType: media.mediaType,
        hint: msg.image.caption ?? '',
        dedupeId: msg.id,
      })
      resumo = r.resumo
    }
  } else if (msg.type === 'document' && msg.document?.id && /image\//.test(msg.document.mime_type ?? '')) {
    // Imagem enviada "como documento" (sem compressão) também funciona.
    const media = await downloadMedia(msg.document.id, token)
    resumo = media
      ? (await processMessage({ kind: 'imagem', mediaBase64: media.base64, mediaType: media.mediaType, hint: msg.document.caption ?? '', dedupeId: msg.id })).resumo
      : '❌ Não consegui baixar o arquivo.'
  } else {
    resumo = '🤖 Manda uma FOTO do comprovante/extrato (legenda "holerite" se for holerite) ou um texto tipo "gastei 50 no mercado".'
  }

  if (resumo) await reply(phoneNumberId, msg.from!, resumo, token)
  return ok()
}
