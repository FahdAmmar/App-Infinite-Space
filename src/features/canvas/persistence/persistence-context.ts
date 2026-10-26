import { createContext, useContext } from 'react'

export interface PersistenceActions {
  /** إعادة محاولة الحفظ بعد فشل */
  retry: () => void
}

export const PersistenceContext = createContext<PersistenceActions | null>(null)

export function usePersistence(): PersistenceActions {
  const value = useContext(PersistenceContext)
  if (!value) throw new Error('usePersistence must be used inside <CanvasPersistenceProvider>')
  return value
}
