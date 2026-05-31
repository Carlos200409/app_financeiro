'use client'
import { useState, useEffect, useRef, ReactNode } from 'react'
import { DataContext, saveData, getCurrentMonth } from '@/lib/store'
import { FinanceData, MonthKey } from '@/lib/types'
import { supabase, TABLE, ROW_ID } from '@/lib/supabase'
import initialData from '@/lib/initial-data.json'

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
  const [ready, setReady] = useState(false)
  const isSaving = useRef(false)

  useEffect(() => {
    // Carrega dados do Supabase (ou usa os dados iniciais da planilha)
    loadFromSupabase().then(remoteData => {
      const finalData = remoteData ?? (initialData as FinanceData)
      setDataState(finalData)
      saveData(finalData)
      if (!remoteData) saveToSupabase(finalData) // seed inicial
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
  }, [])

  const setData = (d: FinanceData) => {
    isSaving.current = true
    setDataState(d)
    saveData(d)
    saveToSupabase(d).finally(() => {
      setTimeout(() => { isSaving.current = false }, 500)
    })
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#070711] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4d8dff] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <DataContext.Provider value={{ data, setData, currentMonth, setCurrentMonth }}>
      {children}
    </DataContext.Provider>
  )
}
