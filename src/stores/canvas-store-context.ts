import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { CanvasState, CanvasStoreApi } from './canvas-store'

export const CanvasStoreContext = createContext<CanvasStoreApi | null>(null)

/** الوصول لواجهة المخزن نفسها (للقراءة الفورية getState() داخل معالجات الأحداث دون اشتراك). */
export function useCanvasStoreApi(): CanvasStoreApi {
  const api = useContext(CanvasStoreContext)
  if (!api) throw new Error('useCanvasStoreApi must be used inside <CanvasStoreProvider>')
  return api
}

export function useCanvasStore<T>(selector: (state: CanvasState) => T): T {
  return useStore(useCanvasStoreApi(), selector)
}
