'use client'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

// Entrada suave (fade + sobe) a cada troca de página. Dá um toque premium
// sem tocar em cada tela — a key no pathname reanima na navegação.
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
