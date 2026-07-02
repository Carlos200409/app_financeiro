import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import DataProvider from '@/components/DataProvider'
import QuickAdd from '@/components/QuickAdd'
import PageTransition from '@/components/PageTransition'

export const metadata: Metadata = {
  title: 'Finance Dashboard',
  description: 'Controle financeiro pessoal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Finance',
  },
}

export const viewport: Viewport = {
  themeColor: '#070711',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full bg-[#070711] text-white">
        <DataProvider>
          <div className="flex min-h-screen">
            <Navigation />
            <main className="flex-1 md:ml-60 pb-24 md:pb-0 min-h-screen">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <QuickAdd />
        </DataProvider>
      </body>
    </html>
  )
}
