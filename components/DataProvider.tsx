'use client'
import { useState, useEffect, useRef, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { DataContext, saveData, getCurrentMonth } from '@/lib/store'
import { FinanceData, MONTHS } from '@/lib/types'
import { supabase, TABLE } from '@/lib/supabase'
import { periodsWithData } from '@/lib/finance-summary'
import Login from './Login'

const emptyData: FinanceData = {
  transactions: [],
  installments: [],
  investments: [],
  monthlySummaries: MONTHS.map(month => ({ month, receita: 0, fixos: 0, extras: 0, saldo: 0 })),
  importedAt: new Date().toISOString(),
}

async function loadFromSupabase(uid: string): Promise<FinanceData | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) return null
    return data.data as FinanceData
  } catch {
    return null
  }
}

async function saveToSupabase(uid: string, financeData: FinanceData): Promise<void> {
  try {
    await supabase
      .from(TABLE)
      .upsert({ user_id: uid, data: financeData, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  } catch {
    // silently fail — dados já salvos no localStorage
  }
}

export default function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<FinanceData | null>(null)
  const [currentMonth, setCurrentMonth] = useState<string>(getCurrentMonth())
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [ready, setReady] = useState(false)
  const isSaving = useRef(false)
  const monthInit = useRef(false)
  // Sempre aponta pro estado mais recente — é o que o updater funcional lê.
  const dataRef = useRef<FinanceData | null>(null)

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
    const uid = session.user.id
    setReady(false)
    // Carrega SÓ a linha deste usuário (ou cria a dele, vazia).
    loadFromSupabase(uid).then(remoteData => {
      const finalData = remoteData ?? emptyData
      dataRef.current = finalData
      setDataState(finalData)
      saveData(finalData, uid)
      if (!remoteData) saveToSupabase(uid, emptyData)
      // Abre no último período que tem dados (não no mês atual vazio).
      if (!monthInit.current) {
        const periodos = periodsWithData(finalData)
        if (periodos.length > 0) setCurrentMonth(periodos[periodos.length - 1])
        monthInit.current = true
      }
      setReady(true)
    })

    // Escuta mudanças de outros devices em tempo real — SÓ da linha deste usuário.
    const channel = supabase
      .channel(`finance_sync:${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE, filter: `user_id=eq.${uid}` },
        (payload) => {
          if (!isSaving.current) {
            const updated = (payload.new as { data: FinanceData }).data
            dataRef.current = updated
            setDataState(updated)
            saveData(updated, uid)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  const setData = (d: FinanceData | ((prev: FinanceData) => FinanceData)) => {
    const uid = session?.user.id
    if (!uid) return
    // Updater funcional lê dataRef (estado ATUAL), não um closure velho — dois
    // uploads em voo somam em vez de um sobrescrever o outro.
    const next = typeof d === 'function' ? (dataRef.current ? d(dataRef.current) : null) : d
    if (!next) return
    isSaving.current = true
    dataRef.current = next
    setDataState(next)
    saveData(next, uid)
    saveToSupabase(uid, next).finally(() => {
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
