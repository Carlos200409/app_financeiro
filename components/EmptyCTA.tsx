import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

// Estado vazio padrão das telas: convite pra analisar um extrato.
export default function EmptyCTA({ title, text, cta = 'Analisar extrato' }: { title: string; text: string; cta?: string }) {
  return (
    <div className="bg-[#141424] border border-[#1a1a2e] rounded-2xl p-8 text-center">
      <Sparkles className="w-8 h-8 text-[#4d8dff] mx-auto mb-3" />
      <p className="font-medium">{title}</p>
      <p className="text-[#7070a0] text-sm mt-1 mb-4">{text}</p>
      <Link
        href="/analise"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4d8dff] text-white text-sm font-medium hover:bg-[#3d7dee] transition-colors"
      >
        {cta} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
