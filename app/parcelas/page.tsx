import { redirect } from 'next/navigation'

// Parcelas agora vivem na aba Gastos.
export default function Parcelas() {
  redirect('/gastos')
}
