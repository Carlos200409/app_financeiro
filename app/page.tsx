import { redirect } from 'next/navigation'

// A home agora é o Resumo. A Dashboard antiga foi aposentada.
export default function Home() {
  redirect('/resumo')
}
