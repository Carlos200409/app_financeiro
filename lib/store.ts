'use client'
import { createContext, useContext } from 'react'
import { FinanceData, MonthKey, MONTHS } from './types'

export const STORAGE_KEY = 'finance_data_v1'

export function saveData(data: FinanceData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full
  }
}

export function loadData(): FinanceData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearData() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function getCurrentMonth(): MonthKey {
  const idx = new Date().getMonth()
  return MONTHS[idx]
}

export interface DataContextType {
  data: FinanceData | null
  // Aceita updater funcional: setData(prev => ...) lê o estado ATUAL na hora de
  // gravar — assim dois uploads em voo não se sobrescrevem (stale closure).
  setData: (d: FinanceData | ((prev: FinanceData) => FinanceData)) => void
  currentMonth: MonthKey
  setCurrentMonth: (m: MonthKey) => void
}

export const DataContext = createContext<DataContextType>({
  data: null,
  setData: () => {},
  currentMonth: 'JAN',
  setCurrentMonth: () => {},
})

export const useData = () => useContext(DataContext)
