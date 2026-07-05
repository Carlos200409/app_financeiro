import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildAIContext } from '@/lib/ai-context'
import { applyImport, ImportPayload } from '@/lib/apply-import'
import { computeSummary } from '@/lib/finance-summary'
import {
  EXTRATO_FOTO_SCHEMA, EXTRATO_FOTO_SYSTEM,
  HOLERITE_SCHEMA, HOLERITE_SYSTEM,
  TEXTO_GASTO_SCHEMA, TEXTO_GASTO_SYSTEM,
} from '@/lib/ai-prompts'
import { fmt } from '@/lib/format'
import { FinanceData, Holerite } from '@/lib/types'
import { TABLE, ROW_ID } from '@/lib/supabase'

// Porta de entrada do WhatsApp (via n8n): recebe foto de comprovante/extrato/
// holerite ou texto ("gastei 50 no mercado"), a IA processa e salva direto no
// Supabase. Auth de MÁQUINA (x-ingest-secret) — o n8n não tem sessão de usuário.
// A resposta `resumo` é o texto que o n8n devolve no WhatsApp.

const MODEL = 'claude-sonnet-4-6'
export const maxDuration = 60

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function parseAI(message: Anthropic.Message): Record<string, unknown> {
  const textBlock = message.content.find((b) => b.type === 'text')
  return JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')
}

export async function POST(request: Request) {
  // ── Auth de máquina ────────────────────────────────────────────────────────
  const secret = process.env.INGEST_SECRET
  if (!secret) return Response.json({ error: 'INGEST_SECRET não configurado no servidor.' }, { status: 500 })
  if (request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!serviceKey || !apiKey) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY/ANTHROPIC_API_KEY não configuradas.' }, { status: 500 })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let kind: string, text: string, mediaBase64: string, mediaType: string, hint: string
  try {
    const body = await request.json()
    kind = body.kind
    text = typeof body.text === 'string' ? body.text.slice(0, 2000) : ''
    mediaBase64 = typeof body.mediaBase64 === 'string' ? body.mediaBase64 : ''
    mediaType = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg'
    hint = typeof body.hint === 'string' ? body.hint.slice(0, 500) : ''
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (kind !== 'texto' && kind !== 'imagem') {
    return Response.json({ error: "kind deve ser 'texto' ou 'imagem'." }, { status: 400 })
  }
  if (kind === 'imagem' && !mediaBase64) return Response.json({ error: 'mediaBase64 vazio.' }, { status: 400 })
  if (kind === 'texto' && !text) return Response.json({ error: 'text vazio.' }, { status: 400 })

  // ── Carrega o estado atual (service role — só servidor) ───────────────────
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const { data: row, error: loadErr } = await supabase.from(TABLE).select('data').eq('id', ROW_ID).single()
  if (loadErr || !row) return Response.json({ error: 'Não consegui carregar os dados.' }, { status: 500 })
  const data = row.data as FinanceData

  const context = buildAIContext(data)
  const installments = (data.installments ?? [])
    .filter((p) => p.status === 'ATIVO')
    .map((p) => ({ id: p.id, description: p.description, value: p.valuePerInstallment }))

  const client = new Anthropic({ apiKey })
  const save = async (next: FinanceData) => {
    const { error } = await supabase
      .from(TABLE)
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq('id', ROW_ID)
    if (error) throw new Error('Falha ao salvar no Supabase.')
  }

  try {
    // ── Holerite por foto (caption menciona "holerite") ──────────────────────
    if (kind === 'imagem' && /holerite|contracheque|salario|salário/i.test(hint)) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: HOLERITE_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: HOLERITE_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as MediaType, data: mediaBase64 } },
            { type: 'text', text: 'Leia este holerite e extraia os dados no formato pedido.' },
          ],
        }],
      })
      const parsed = parseAI(message)
      if (!parsed.ehHolerite) {
        return Response.json({ ok: false, resumo: '❌ Isso não parece um holerite. Manda uma foto mais nítida.' })
      }
      const h = { ...(parsed as unknown as Holerite), addedAt: new Date().toISOString() }
      await save({ ...data, holerites: [...(data.holerites ?? []), h] })
      return Response.json({
        ok: true,
        resumo: `✓ Holerite registrado: ${h.competencia || 'competência não lida'} (${h.tipo}) — líquido ${fmt(h.liquido)}.`,
      })
    }

    // ── Comprovante/extrato/nota por foto ────────────────────────────────────
    if (kind === 'imagem') {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: EXTRATO_FOTO_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: EXTRATO_FOTO_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as MediaType, data: mediaBase64 } },
            {
              type: 'text',
              text: `${context ? `CONTEXTO DO USUÁRIO:\n${context}\n\n` : ''}${
                installments.length
                  ? `PARCELAS ATIVAS (marque parcelaId se alguma transação for o pagamento de uma delas):\n${installments.map((p) => `- id=${p.id} | ${p.description} | R$ ${p.value.toFixed(2)}/mês`).join('\n')}\n\n`
                  : ''
              }${hint ? `LEGENDA DO USUÁRIO: ${hint}\n\n` : ''}Leia e extraia as transações no formato pedido.`,
            },
          ],
        }],
      })
      const parsed = parseAI(message) as { ehExtrato?: boolean; transactions?: ImportPayload['transactions']; verdict?: string; source?: string }
      if (!parsed.ehExtrato || !parsed.transactions?.length) {
        return Response.json({ ok: false, resumo: '❌ Não achei transações nessa imagem. Tenta uma foto mais nítida.' })
      }
      const validIds = new Set(installments.map((p) => p.id))
      const transactions = parsed.transactions.map((t) => ({
        ...t,
        parcelaId: t.parcelaId && validIds.has(t.parcelaId) ? t.parcelaId : undefined,
      }))
      const r = applyImport(data, { transactions, verdict: parsed.verdict, source: parsed.source || 'WhatsApp' })
      await save(r.next)
      const s = computeSummary(r.next, r.periodo)
      const itens = transactions.length === 1
        ? `${transactions[0].description} ${fmt(transactions[0].amount)}`
        : `${transactions.length} itens`
      return Response.json({
        ok: true,
        resumo: `✓ Registrado (${r.group.source}): ${itens}.${r.parcelasPagas.length ? ` ✓ Parcela paga: ${r.parcelasPagas.join(' · ')}.` : ''}${s ? ` Gastos do mês: ${fmt(s.gastos)}.` : ''}`,
      })
    }

    // ── Texto ("gastei 50 no mercado ontem") ─────────────────────────────────
    const hoje = new Date().toISOString().slice(0, 10)
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: TEXTO_GASTO_SYSTEM,
      output_config: { format: { type: 'json_schema', schema: TEXTO_GASTO_SCHEMA } },
      messages: [{
        role: 'user',
        content: `${context ? `CONTEXTO DO USUÁRIO:\n${context}\n\n` : ''}DATA ATUAL: ${hoje}\n\nMensagem: ${text}`,
      }],
    })
    const parsed = parseAI(message) as { entendi?: boolean; date?: string; description?: string; amount?: number; category?: string; level?: string; recurring?: boolean }
    if (!parsed.entendi || !parsed.description || typeof parsed.amount !== 'number') {
      return Response.json({ ok: false, resumo: '🤔 Não entendi como gasto. Tenta tipo: "gastei 50 no mercado" ou "recebi 200 de corrida".' })
    }
    const r = applyImport(data, {
      transactions: [{
        date: parsed.date || hoje,
        description: parsed.description,
        amount: parsed.amount,
        category: parsed.category || 'Outros',
        level: (parsed.level as 'essencial' | 'util' | 'superfluo') || 'util',
        reason: 'registrado pelo WhatsApp',
        recurring: !!parsed.recurring,
      }],
      source: 'WhatsApp',
    })
    await save(r.next)
    const s = computeSummary(r.next, r.periodo)
    return Response.json({
      ok: true,
      resumo: `✓ Registrado: ${parsed.description} ${fmt(parsed.amount)} (${parsed.category}/${parsed.level}).${s ? ` Gastos do mês: ${fmt(s.gastos)}.` : ''}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/credit balance is too low/i.test(msg)) {
      return Response.json({ ok: false, resumo: '❌ Créditos da IA acabaram — recarrega em console.anthropic.com.' }, { status: 402 })
    }
    console.error('ingest error', e)
    return Response.json({ ok: false, resumo: '❌ Erro ao processar. Tenta de novo.' }, { status: 500 })
  }
}
