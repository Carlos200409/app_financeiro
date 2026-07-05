import { FinanceData } from './types'

// Monta o contexto pessoal que vai junto com cada análise — é o que faz a IA
// julgar COM O USUÁRIO em mente (essencial/útil/besteira deixa de ser genérico)
// e parar de repetir categorizações que ele já corrigiu.
export function buildAIContext(data: FinanceData | null): string {
  if (!data) return ''
  const parts: string[] = []

  if (data.sobreMim?.trim()) {
    parts.push(`SOBRE O USUÁRIO: ${data.sobreMim.trim()}`)
  }

  const ultimoHolerite = (data.holerites ?? []).slice(-1)[0]
  if (ultimoHolerite) {
    parts.push(`Renda: recebe ~R$ ${ultimoHolerite.liquido.toFixed(2)} líquido (${ultimoHolerite.tipo}) de salário${ultimoHolerite.salarioBase ? `, base R$ ${ultimoHolerite.salarioBase.toFixed(2)}` : ''}.`)
  }

  const parcelas = (data.installments ?? []).filter((p) => p.status === 'ATIVO')
  if (parcelas.length) {
    parts.push(`Parcelas ativas: ${parcelas.map((p) => `${p.description} (R$ ${p.valuePerInstallment.toFixed(2)}/mês)`).join('; ')}.`)
  }

  const correcoes = (data.correcoes ?? []).slice(-30)
  if (correcoes.length) {
    parts.push(
      'O USUÁRIO JÁ CORRIGIU estas classificações — siga-as SEMPRE que a descrição for parecida:\n' +
        correcoes.map((c) => `- "${c.description}" → ${c.category} / ${c.level}`).join('\n'),
    )
  }

  return parts.join('\n')
}
