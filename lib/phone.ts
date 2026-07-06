// Forma canônica de um número BR pra casar independente de como a Meta formata
// (com/sem o 55, com/sem o 9 de celular). É a chave de phone_links.
export function normBR(n: string): string {
  let d = (n ?? '').replace(/\D/g, '')
  if (d.startsWith('55')) d = d.slice(2)
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3)
  return d
}
