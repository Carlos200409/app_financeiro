import Anthropic from '@anthropic-ai/sdk'
import { isAuthenticated } from './auth-guard'

// Envelope único das rotas de IA: exige login, monta o client (key só no
// servidor) e traduz os erros comuns (auth, crédito acabou) em mensagens claras.
export async function withClaude(
  request: Request,
  fn: (client: Anthropic) => Promise<Response>,
): Promise<Response> {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: 'Faça login para usar a IA.' }, { status: 401 })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }
  try {
    return await fn(new Anthropic({ apiKey }))
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'API key do Claude inválida.' }, { status: 401 })
    }
    const msg = e instanceof Error ? e.message : String(e)
    if (/credit balance is too low/i.test(msg)) {
      return Response.json(
        { error: 'Os créditos da API do Claude acabaram. Adicione em console.anthropic.com → Billing e tente de novo.' },
        { status: 402 },
      )
    }
    console.error('claude route error', e)
    return Response.json({ error: 'Erro ao processar. Tente de novo.' }, { status: 500 })
  }
}
