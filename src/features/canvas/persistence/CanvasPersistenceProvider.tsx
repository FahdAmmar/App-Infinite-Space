import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { storage } from '@/services/persistence'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { createCanvasPersistence, type CanvasPersistence } from './canvas-persistence'
import { PersistenceContext, type PersistenceActions } from './persistence-context'

/**
 * يربط مخزن اللوحة بالحفظ التلقائي طوال عمر المحرر، ويحفظ عند المغادرة:
 *  - إغلاق المحرر (التنقل لصفحة أخرى): حفظ فوري لما لم يُحفظ بعد.
 *  - إخفاء الصفحة أو إغلاقها (pagehide، visibilitychange): نبدأ الحفظ فوراً (محاولة بأفضل جهد: المتصفح
 *    لا يضمن اكتمال كتابة غير متزامنة أثناء الإغلاق).
 *  - beforeunload: إن كانت هناك تعديلات لم تُحفظ بعد أو فشل حفظ، يسأل المتصفح المستخدم قبل المغادرة.
 */
export function CanvasPersistenceProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const store = useCanvasStoreApi()
  const controllerRef = useRef<CanvasPersistence | null>(null)

  useEffect(() => {
    const controller = createCanvasPersistence({
      workspaceId,
      store,
      storage,
      onSaved: (summary, contentChanged) =>
        useWorkspaceStore.getState().recordCanvasSummary(workspaceId, summary, contentChanged),
    })
    controllerRef.current = controller

    const flushNow = (): void => void controller.flush()
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!controller.hasUnsavedChanges() && store.getState().saveStatus.kind !== 'saving') return
      flushNow()
      event.preventDefault() // يعرض المتصفح تأكيد المغادرة (النص ثابت من المتصفح)
    }
    window.addEventListener('pagehide', flushNow)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('pagehide', flushNow)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      // مغادرة المحرر: نحفظ ما تبقى (الحفظ يقرأ المخزن لحظة تنفيذه فلا يتأثر بإزالة المكوّن)
      void controller.flush()
      controller.dispose()
      controllerRef.current = null
    }
  }, [store, workspaceId])

  const retry = useCallback(() => void controllerRef.current?.retry(), [])
  const value = useMemo<PersistenceActions>(() => ({ retry }), [retry])

  return <PersistenceContext value={value}>{children}</PersistenceContext>
}
