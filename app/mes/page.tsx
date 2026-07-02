import { redirect } from 'next/navigation'

// A visão mensal foi absorvida pelo Histórico e pelo Resumo.
export default function Mes() {
  redirect('/historico')
}
