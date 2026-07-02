'use client'
import { useState, useEffect, useRef, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { DataContext, saveData, getCurrentMonth } from '@/lib/store'
import { FinanceData, MonthKey, MONTHS } from '@/lib/types'
import { supabase, TABLE, ROW_ID } from '@/lib/supabase'
import { monthsWithData } from '@/lib/finance-summary'
import Login from './Login'

const emptyData: FinanceData = {
  transactions: [],
  installments: [],
  investments: [],
  monthlySummaries: MONTHS.map(month => ({ month, receita: 0, fixos: 0, extras: 0, investimentos: 0, saldo: 0 })),
  importedAt: new Date().toISOString(),
}

async function loadFromSupabase(): Promise<FinanceData | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', ROW_ID)
      .single()
    if (error || !data) return null
    return data.data as FinanceData
  } catch {
    return null
  }
}

async function saveToSupabase(financeData: FinanceData): Promise<void> {
  try {
    await supabase
      .from(TABLE)
      .upsert({ id: ROW_ID, data: financeData, updated_at: new Date().toISOString() })
  } catch {
    // silently fail — dados já salvos no localStorage
  }
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<FinanceData | null>(null)
  const [currentMonth, setCurrentMonth] = useState<MonthKey>(getCurrentMonth())
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [ready, setReady] = useState(false)
  const isSaving = useRef(false)
  const monthInit = useRef(false)

  // Autenticação: sem sessão → tela de login. RLS no Supabase só libera dados
  // pra quem está logado, então nada carrega sem sessão.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setReady(false)
    // Carrega dados do Supabase (ou usa os dados iniciais)
    loadFromSupabase().then(remoteData => {
      const finalData = remoteData ?? emptyData
      setDataState(finalData)
      saveData(finalData)
      if (!remoteData) saveToSupabase(emptyData)
      // Abre no último mês que tem dados (não no mês atual vazio).
      if (!monthInit.current) {
        const meses = monthsWithData(finalData)
        if (meses.length > 0) setCurrentMonth(meses[meses.length - 1])
        monthInit.current = true
      }
      setReady(true)
    })

    // Escuta mudanças de outros devices em tempo real
    const channel = supabase
      .channel('finance_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE },
        (payload) => {
          if (!isSaving.current) {
            const updated = (payload.new as { data: FinanceData }).data
            setDataState(updated)
            saveData(updated)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const setData = (d: FinanceData) => {
    isSaving.current = true
    setDataState(d)
    saveData(d)
    saveToSupabase(d).finally(() => {
      setTimeout(() => { isSaving.current = false }, 500)
    })
  }

  const spinner = (
    <div className="min-h-screen bg-[#070711] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#4d8dff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!authReady) return spinner
  if (!session) return <Login />
  if (!ready) return spinner

  return (
    <DataContext.Provider value={{ data, setData, currentMonth, setCurrentMonth }}>
      {children}
    </DataContext.Provider>
  )
}
