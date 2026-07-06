import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildAIContext } from './ai-context'
import { applyImport, ImportPayload } from './apply-import'
import { computeSummary } from './finance-summary'
import { estimatedLeak, LeakReport } from './leaks'
import {
  EXTRATO_FOTO_SCHEMA, EXTRATO_FOTO_SYSTEM,
  HOLERITE_SCHEMA, HOLERITE_SYSTEM,
  TEXTO_GASTO_SCHEMA, TEXTO_GASTO_SYSTEM,
} from './ai-prompts'
import { fmt } from './format'
import { FinanceData, Holerite } from './types'
import { TABLE } from './supabase'

// Núcleo do registro por mensagem (WhatsApp): recebe foto de comprovante/
// extrato/holerite ou texto ("gastei 50 no mercado"), a IA processa e salva
// direto no Supabase (service role — só servidor). Usado pelo webhook
// /api/whatsapp (Meta) e pelo /api/ingest (n8n/curl). Devolve o `resumo`
// que vira a resposta no chat.

const MODEL = 'claude-sonnet-4-6'

export interface IngestInput {
  kind: 'texto' | 'imagem'
  text?: string
  mediaBase64?: string
  mediaType?: string
  hint?: string
  dedupeId?: string // id da mensagem (Meta re-tenta webhooks — não processar 2x)
}

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function parseAI(message: Anthropic.Message): Record<string, unknown> {
  const textBlock = message.content.find((b) => b.type === 'text')
  return JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')
}

const METODO_LABEL: Record<string, string> = {
  pix: 'Pix', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', boleto: 'Boleto',
}

// "2026-07-05" → "05/07/2026"
function dataBR(iso?: string): string {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Relatório de caça-vazamento pro WhatsApp — determinístico, sem IA (custo zero).
function leakCard(l: LeakReport): string {
  if (l.total <= 0) return '✅ Não achei desperdício óbvio esse mês. Tá indo bem!'
  const linhas = [`💸 Achei ${fmt(l.total)} vazando esse mês:`]
  if (l.assinaturas.total > 0) linhas.push(`📌 ${fmt(l.assinaturas.total)} em assinaturas (${l.assinaturas.items.length}) — ${l.assinaturas.items.slice(0, 4).map((t) => t.description).join(', ')}`)
  if (l.besteira > 0) linhas.push(`🔥 ${fmt(l.besteira)} em besteira (supérfluo)`)
  if (l.duplicadas.total > 0) linhas.push(`⚠️ ${fmt(l.duplicadas.total)} em cobranças duplicadas: ${l.duplicadas.groups.slice(0, 3).map((g) => g.description).join(', ')}`)
  for (const c of l.creep.slice(0, 2)) linhas.push(`📈 ${c.category} subiu ${(c.deltaPct * 100).toFixed(0)}% vs mês passado`)
  return linhas.join('\n')
}

// Padrão de resposta no WhatsApp: item | valor | pagamento | categoria | data.
function cardItem(t: { description: string; amount: number; category: string; level: string; date?: string; metodo?: string; parcelasInfo?: string }): string {
  const linhas = [
    `🛒 ${t.description}`,
    `💰 ${fmt(t.amount)}`,
  ]
  const pag = [t.metodo ? METODO_LABEL[t.metodo] ?? t.metodo : '', t.parcelasInfo].filter(Boolean).join(' · ')
  if (pag) linhas.push(`💳 ${pag}`)
  linhas.push(`🏷️ ${t.category} (${t.level})`)
  const d = dataBR(t.date)
  if (d) linhas.push(`📅 ${d}`)
  return linhas.join('\n')
}

export async function processMessage(input: IngestInput, userId: string): Promise<{ ok: boolean; resumo: string; status: number }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!serviceKey || !apiKey) {
    return { ok: false, resumo: '❌ Servidor sem SUPABASE_SERVICE_ROLE_KEY/ANTHROPIC_API_KEY.', status: 500 }
  }
  if (!userId) return { ok: false, resumo: '❌ Conta não identificada.', status: 400 }

  const text = (input.text ?? '').slice(0, 2000)
  const hint = (input.hint ?? '').slice(0, 500)
  const mediaType = (input.mediaType ?? 'image/jpeg') as MediaType
  if (input.kind === 'imagem' && !input.mediaBase64) return { ok: false, resumo: 'mediaBase64 vazio.', status: 400 }
  if (input.kind === 'texto' && !text) return { ok: false, resumo: 'text vazio.', status: 400 }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  const { data: row, error: loadErr } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle()
  if (loadErr) return { ok: false, resumo: '❌ Não consegui carregar os dados.', status: 500 }
  if (!row) return { ok: false, resumo: '👋 Abre o app primeiro pra criar sua conta, aí eu registro pelo WhatsApp.', status: 200 }
  const data = row.data as FinanceData

  // Dedupe: a Meta re-envia o webhook se a resposta demorar — não registrar 2x.
  if (input.dedupeId && (data.waIds ?? []).includes(input.dedupeId)) {
    return { ok: true, resumo: '', status: 200 }
  }

  const context = buildAIContext(data)
  const installments = (data.installments ?? [])
    .filter((p) => p.status === 'ATIVO')
    .map((p) => ({ id: p.id, description: p.description, value: p.valuePerInstallment }))

  const client = new Anthropic({ apiKey })
  const save = async (next: FinanceData) => {
    const withDedupe = input.dedupeId
      ? { ...next, waIds: [...(next.waIds ?? []), input.dedupeId].slice(-50) }
      : next
    const { error } = await supabase
      .from(TABLE)
      .update({ data: withDedupe, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw new Error('Falha ao salvar no Supabase.')
  }

  try {
    // ── Holerite por foto (legenda menciona "holerite") ──────────────────────
    if (input.kind === 'imagem' && /holerite|contracheque|salario|salário/i.test(hint)) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: HOLERITE_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: HOLERITE_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: input.mediaBase64! } },
            { type: 'text', text: 'Leia este holerite e extraia os dados no formato pedido.' },
          ],
        }],
      })
      const parsed = parseAI(message)
      if (!parsed.ehHolerite) {
        return { ok: false, resumo: '❌ Isso não parece um holerite. Manda uma foto mais nítida.', status: 200 }
      }
      const h = { ...(parsed as unknown as Holerite), addedAt: new Date().toISOString() }
      await save({ ...data, holerites: [...(data.holerites ?? []), h] })
      return {
        ok: true,
        resumo: `✓ Holerite registrado: ${h.competencia || 'competência não lida'} (${h.tipo}) — líquido ${fmt(h.liquido)}.`,
        status: 200,
      }
    }

    // ── Comprovante/extrato/nota por foto ────────────────────────────────────
    if (input.kind === 'imagem') {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: EXTRATO_FOTO_SYSTEM,
        output_config: { format: { type: 'json_schema', schema: EXTRATO_FOTO_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: input.mediaBase64! } },
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
        return { ok: false, resumo: '❌ Não achei transações nessa imagem. Tenta uma foto mais nítida.', status: 200 }
      }
      const validIds = new Set(installments.map((p) => p.id))
      const transactions = parsed.transactions.map((t) => ({
        ...t,
        parcelaId: t.parcelaId && validIds.has(t.parcelaId) ? t.parcelaId : undefined,
      }))
      const r = applyImport(data, { transactions, verdict: parsed.verdict, source: parsed.source || 'WhatsApp' })
      await save(r.next)
      const s = computeSummary(r.next, r.periodo)
      // 1 item → cartão completo; vários → total + primeiras linhas.
      const total = transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)
      const corpo = transactions.length === 1
        ? cardItem(transactions[0])
        : `📄 ${r.group.source}: ${transactions.length} itens · total ${fmt(total)}\n` +
          transactions.slice(0, 5).map((t) => `• ${t.description} — ${fmt(t.amount)}${t.metodo ? ` (${METODO_LABEL[t.metodo] ?? t.metodo})` : ''}`).join('\n') +
          (transactions.length > 5 ? `\n… e mais ${transactions.length - 5} itens (vê em Gastos)` : '')
      const rodape = [
        r.parcelasPagas.length ? `✅ Parcela paga: ${r.parcelasPagas.join(' · ')}` : '',
        r.unificados.length ? `♻️ ${r.unificados.length} registro(s) do WhatsApp unificado(s) com a fatura (sem contar 2x)` : '',
        s ? `———\nGastos do mês: ${fmt(s.gastos)}` : '',
      ].filter(Boolean).join('\n')
      return { ok: true, resumo: `✓ Registrado\n${corpo}${rodape ? `\n${rodape}` : ''}`, status: 200 }
    }

    // ── "onde vaza meu dinheiro?" → relatório determinístico (sem IA) ────────
    if (/vaza|vazamento|desperd|jogando.*fora|onde.*(dinheiro|grana|gast)/i.test(text)) {
      return { ok: true, resumo: leakCard(estimatedLeak(data, new Date().toISOString().slice(0, 7))), status: 200 }
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
    const parsed = parseAI(message) as { entendi?: boolean; date?: string; description?: string; amount?: number; category?: string; level?: string; recurring?: boolean; metodo?: string; parcelasInfo?: string }
    if (!parsed.entendi || !parsed.description || typeof parsed.amount !== 'number') {
      return { ok: false, resumo: '🤔 Não entendi como gasto. Tenta tipo: "gastei 50 no mercado no pix" ou "recebi 200 de corrida".', status: 200 }
    }
    const item = {
      date: parsed.date || hoje,
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category || 'Outros',
      level: (parsed.level as 'essencial' | 'util' | 'superfluo') || 'util',
      reason: 'registrado pelo WhatsApp',
      recurring: !!parsed.recurring,
      metodo: parsed.metodo || undefined,
      parcelasInfo: parsed.parcelasInfo || undefined,
    }
    const r = applyImport(data, { transactions: [item], source: 'WhatsApp' })
    await save(r.next)
    const s = computeSummary(r.next, r.periodo)
    return {
      ok: true,
      resumo: `✓ Registrado\n${cardItem(item)}${s ? `\n———\nGastos do mês: ${fmt(s.gastos)}` : ''}`,
      status: 200,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/credit balance is too low/i.test(msg)) {
      return { ok: false, resumo: '❌ Créditos da IA acabaram — recarrega em console.anthropic.com.', status: 402 }
    }
    console.error('ingest-core error', e)
    return { ok: false, resumo: '❌ Erro ao processar. Tenta de novo.', status: 500 }
  }
}
