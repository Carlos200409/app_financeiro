// Lê extrato bruto de banco (CSV/OFX) e devolve transações cruas.
// Roda no navegador: o arquivo nunca sai do cliente; só as linhas parseadas
// vão pro servidor. Bancos exportam em formatos diferentes, então o parser
// é heurístico — acha as colunas por palavra-chave em vez de exigir um layout fixo.

export interface RawTransaction {
  date: string // ISO YYYY-MM-DD quando dá pra inferir; senão o texto original
  description: string
  amount: number // negativo = saída, positivo = entrada
}

// "1.234,56" (BR) ou "1234.56" (US) ou "-R$ 39,90" → número
export function parseAmount(raw: string): number {
  let s = raw.replace(/[R$\s]/g, '').trim()
  if (!s) return NaN
  const negative = /^-/.test(s) || /\(.*\)/.test(s) // -10 ou (10)
  s = s.replace(/[()]/g, '').replace(/^-/, '')
  // Se tem vírgula E ponto, o último separador é o decimal.
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.') // só vírgula → decimal BR
  }
  const n = parseFloat(s)
  if (isNaN(n)) return NaN
  return negative ? -n : n
}

// "31/12/2026", "2026-12-31", "20261231" → "2026-12-31"; senão devolve o texto
export function parseDate(raw: string): string {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})/) // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})/) // OFX DTPOSTED: YYYYMMDD...
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return s
}

function detectDelimiter(line: string): string {
  const counts = [';', ',', '\t'].map((d) => [d, line.split(d).length] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 1 ? counts[0][0] : ','
}

// Divide uma linha CSV respeitando aspas
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === delim && !inQuotes) {
      out.push(cur); cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const DATE_KEYS = ['data', 'date', 'dt']
const DESC_KEYS = ['descri', 'histor', 'lançamento', 'lancamento', 'title', 'memo', 'estabelecimento', 'detalhe']
const AMOUNT_KEYS = ['valor', 'amount', 'value', 'quantia']

function findCol(header: string[], keys: string[]): number {
  return header.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)))
}

function parseOFX(text: string): RawTransaction[] {
  const txs: RawTransaction[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []
  for (const b of blocks) {
    const tag = (name: string) => b.match(new RegExp(`<${name}>([^<\r\n]*)`, 'i'))?.[1]?.trim() ?? ''
    const amount = parseAmount(tag('TRNAMT'))
    if (isNaN(amount)) continue
    txs.push({
      date: parseDate(tag('DTPOSTED')),
      description: tag('MEMO') || tag('NAME') || 'Sem descrição',
      amount,
    })
  }
  return txs
}

function parseCSV(text: string): RawTransaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const delim = detectDelimiter(lines[0])
  const header = splitCsvLine(lines[0], delim)

  let dateCol = findCol(header, DATE_KEYS)
  let descCol = findCol(header, DESC_KEYS)
  let amountCol = findCol(header, AMOUNT_KEYS)

  // Sem cabeçalho reconhecível: assume [data, descrição, valor] e inclui a 1ª linha.
  const hasHeader = dateCol >= 0 || descCol >= 0 || amountCol >= 0
  if (!hasHeader) { dateCol = 0; descCol = 1; amountCol = 2 }

  const rows = hasHeader ? lines.slice(1) : lines
  const txs: RawTransaction[] = []
  for (const line of rows) {
    const cols = splitCsvLine(line, delim)
    const amount = parseAmount(cols[amountCol] ?? '')
    if (isNaN(amount)) continue
    txs.push({
      date: parseDate(cols[dateCol] ?? ''),
      description: (cols[descCol] ?? 'Sem descrição').replace(/^"|"$/g, '') || 'Sem descrição',
      amount,
    })
  }
  return txs
}

export function parseExtrato(text: string): RawTransaction[] {
  if (/<OFX|<STMTTRN/i.test(text)) return parseOFX(text)
  return parseCSV(text)
}
