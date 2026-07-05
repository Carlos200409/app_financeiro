import { processMessage } from '@/lib/ingest-core'

// Porta genérica de registro por mensagem (n8n, curl, automações): mesma
// lógica do webhook do WhatsApp, mas com auth por secret de máquina.

export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET
  if (!secret) return Response.json({ error: 'INGEST_SECRET não configurado no servidor.' }, { status: 500 })
  if (request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (body.kind !== 'texto' && body.kind !== 'imagem') {
    return Response.json({ error: "kind deve ser 'texto' ou 'imagem'." }, { status: 400 })
  }

  const r = await processMessage({
    kind: body.kind,
    text: typeof body.text === 'string' ? body.text : '',
    mediaBase64: typeof body.mediaBase64 === 'string' ? body.mediaBase64 : '',
    mediaType: typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg',
    hint: typeof body.hint === 'string' ? body.hint : '',
  })
  return Response.json({ ok: r.ok, resumo: r.resumo }, { status: r.status })
}
