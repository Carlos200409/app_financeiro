import { redirect } from 'next/navigation'

// Investimentos agora vivem na aba Investir.
export default function Investimentos() {
  redirect('/investir')
}
