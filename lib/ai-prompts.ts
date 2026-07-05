import { CATEGORIES } from './types'

// Prompts/schemas da IA compartilhados entre as rotas /api e o ingest do
// WhatsApp — fonte única, sem duplicar texto de prompt.

const LEVELS = ['essencial', 'util', 'superfluo'] as const

// ── Extrato/fatura/nota por FOTO ou PDF ─────────────────────────────────────

export const EXTRATO_FOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ehExtrato: { type: 'boolean', description: 'true se a imagem/PDF tem transações financeiras (extrato, fatura, recibo, nota fiscal)' },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          date: { type: 'string', description: 'data ISO YYYY-MM-DD; vazio se não houver' },
          description: { type: 'string' },
          amount: { type: 'number', description: 'negativo = saída/gasto, positivo = entrada' },
          category: { type: 'string', enum: CATEGORIES as unknown as string[] },
          level: { type: 'string', enum: LEVELS as unknown as string[] },
          reason: { type: 'string', description: 'motivo curto; numa nota fiscal, cite os itens principais aqui' },
          recurring: { type: 'boolean' },
          parcelaId: { type: 'string', description: 'se esta transação for o pagamento de uma das PARCELAS ATIVAS listadas, o id dela; senão string vazia' },
        },
        required: ['date', 'description', 'amount', 'category', 'level', 'reason', 'recurring', 'parcelaId'],
      },
    },
    verdict: { type: 'string', description: 'veredito direto sobre ESTA fatura em 2-3 frases: total, onde pesou mais, o que cortar. Valores em R$.' },
    source: { type: 'string', description: 'origem (banco/cartão) do cabeçalho, ex "Cartão Bradesco", "Nubank". "Extrato" se não achar.' },
  },
  required: ['ehExtrato', 'transactions', 'verdict', 'source'],
}

export const EXTRATO_FOTO_SYSTEM = `Você lê extratos bancários, faturas de cartão, recibos e notas fiscais a partir de FOTO ou PDF.

- Extraia CADA transação: data, descrição, valor (negativo = gasto/saída, positivo = entrada).
- A imagem pode estar torta/dobrada/escura — leia mesmo assim. Não invente número que não está lá.
- Categorize cada uma: category (da lista), level (essencial/util/superfluo), recurring (repete todo mês? salário/assinatura/aluguel).
- Numa NOTA FISCAL de uma compra só: registre a compra (estabelecimento + total) e liste os itens principais no campo "reason".
- Entradas positivas = category "Renda", level "essencial".
- "Transferência" é SÓ dinheiro trocando de bolso da própria pessoa (pagamento de fatura de cartão, transferência entre contas próprias, aporte pra corretora) — neutra no cálculo. Pix/TED pagando alguém ou comprando algo é GASTO REAL: use a categoria da compra, nunca "Transferência".
- PARCELAS ATIVAS: se a mensagem listar parcelas (financiamentos) e uma transação parecer o pagamento de uma delas (boleto/financeira, valor próximo — pode vir MENOR por desconto de pontualidade, tolere ~20%), retorne o parcelaId dela. É gasto normal (ex: Transporte pra carro); o id só marca a parcela como paga.
- ⚠️ HOLERITE/CONTRACHEQUE: se a imagem for um holerite (tem salário, vencimentos e descontos tipo INSS/IRRF/FGTS), NÃO liste os descontos como gastos — eles são retidos na fonte, a pessoa NUNCA recebe nem gasta esse valor. Registre APENAS o valor LÍQUIDO como UMA entrada de Renda (amount positivo, category "Renda"). Desconto de folha nunca é saída/gasto.
- Se NÃO houver transação nenhuma (foto aleatória), retorne ehExtrato=false e transactions vazio.
- Em "verdict", o veredito desta fatura em 2-3 frases: total, onde pesou mais, o que cortar. Valores em R$.
- Se houver um bloco CONTEXTO DO USUÁRIO na mensagem, use-o: o julgamento essencial/util/superfluo é pessoal, e correções anteriores do usuário SEMPRE prevalecem.`

// ── Holerite por foto ────────────────────────────────────────────────────────

export const HOLERITE_SCHEMA = {
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

export const HOLERITE_SYSTEM = `Você lê holerites (contracheques) brasileiros a partir de uma foto e extrai os números.

Regras:
- A foto pode estar torta, dobrada ou girada. Leia mesmo assim.
- Entenda a ESTRUTURA, não faça OCR cego:
  - "tipo": se o recibo diz "Adiantamento", é tipo "adiantamento" (é só uma parte do salário do mês). Se é o fechamento/2ª parcela, "fechamento". Se é o salário inteiro num recibo só, "completo".
  - "bruto" = total de vencimentos DESTE recibo (não o salário base).
  - "liquido" = o valor que a pessoa efetivamente recebeu neste recibo.
  - "salarioBase" = o salário cheio, se estiver escrito (mesmo que este recibo seja só um adiantamento).
- FECHAMENTO com desconto de adiantamento: no holerite de fechamento, o
  "adiantamento salarial" aparece como DESCONTO — isso NÃO é imposto nem gasto,
  é só a parte do salário que a pessoa JÁ recebeu antes. O "liquido" deste
  recibo é o que ela recebe AGORA (o app soma adiantamento + fechamento da
  mesma competência pra chegar no salário total do mês). Tipo = "fechamento".
- Se NÃO for um holerite (extrato, nota fiscal, foto qualquer), retorne ehHolerite=false e zere os números.
- Números em reais, use ponto decimal (2000.00, não "2.000,00").`

// ── Gasto por TEXTO ("gastei 50 no mercado ontem") — usado pelo WhatsApp ────

export const TEXTO_GASTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    entendi: { type: 'boolean', description: 'true se a mensagem descreve um gasto ou uma entrada de dinheiro' },
    date: { type: 'string', description: 'data ISO YYYY-MM-DD do gasto (resolva "hoje"/"ontem" pela data atual informada)' },
    description: { type: 'string', description: 'descrição curta, ex "Mercado", "Uber pro centro"' },
    amount: { type: 'number', description: 'negativo = gasto, positivo = entrada' },
    category: { type: 'string', enum: CATEGORIES as unknown as string[] },
    level: { type: 'string', enum: LEVELS as unknown as string[] },
    recurring: { type: 'boolean' },
  },
  required: ['entendi', 'date', 'description', 'amount', 'category', 'level', 'recurring'],
}

export const TEXTO_GASTO_SYSTEM = `Você registra um lançamento financeiro a partir de uma mensagem informal em
português (ex: "gastei 50 no mercado ontem", "recebi 200 de uma corrida").

- amount NEGATIVO pra gasto, POSITIVO pra entrada. "gastei 50" → -50.
- Resolva datas relativas ("hoje", "ontem", "sexta") pela DATA ATUAL informada na mensagem.
- Se não houver data, use a data atual.
- Se a mensagem NÃO descrever gasto/entrada (é pergunta, conversa), retorne entendi=false.
- Se houver um bloco CONTEXTO DO USUÁRIO, use-o pro julgamento essencial/util/superfluo.`
