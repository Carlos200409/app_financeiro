'use client'
import { createContext, useContext } from 'react'
import { FinanceData } from './types'

// Cache local por usuário — namespaced pelo uid pra NÃO vazar dados entre
// contas num navegador compartilhado.
export function storageKey(uid: string): string {
  return `finance_data_v1:${uid}`
}

export function saveData(data: FinanceData, uid: string) {
  if (typeof window === 'undefined' || !uid) return
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(data))
  } catch {
    // storage full
  }
}

// Período do calendário de hoje: "YYYY-MM".
export function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface DataContextType {
  data: FinanceData | null
  // Aceita updater funcional: setData(prev => ...) lê o estado ATUAL na hora de
  // gravar — assim dois uploads em voo não se sobrescrevem (stale closure).
  setData: (d: FinanceData | ((prev: FinanceData) => FinanceData)) => void
  currentMonth: string // período "YYYY-MM" selecionado
  setCurrentMonth: (m: string) => void
}

export const DataContext = createContext<DataContextType>({
  data: null,
  setData: () => {},
  currentMonth: '2026-01',
  setCurrentMonth: () => {},
})

export const useData = () => useContext(DataContext)
