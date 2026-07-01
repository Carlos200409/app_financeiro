export function fmt(value: number): string {
  // converte -0 para 0 para evitar "-R$ 0,00"
  const v = value === 0 ? 0 : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(v)
}

export function fmtShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(value)
  }
  return fmt(value)
}
