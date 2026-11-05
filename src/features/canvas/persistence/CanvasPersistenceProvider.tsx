import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { storage } from '@/services/persistence'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { createCanvasPersistence, type CanvasPersistence } from './canvas-persistence'
import { PersistenceContext, type PersistenceActions } from './persistence-context'
import { createTabSync } from './tab-sync'

/**
 * يربط مخزن اللوحة بالحفظ التلقائي طوال عمر المحرر، ويحفظ عند المغادرة:
 *  - إغلاق المحرر (التنقل لصفحة أخرى): حفظ فوري لما لم يُحفظ بعد.
 *  - إخفاء الصفحة أو إغلاقها (pagehide، visibilitychange): نبدأ الحفظ فوراً (محاولة بأفضل جهد: المتصفح
 *    لا يضمن اكتمال كتابة غير متزامنة أثناء الإغلاق).
 *  - beforeunload: إن كانت هناك تعديلات لم تُحفظ بعد أو فشل حفظ، يسأل المتصفح المستخدم قبل المغادرة.
 *  - تبويب آخر حفظ تغييراً في المساحة نفسها: نوقف الحفظ هنا فوراً (وإلا كتبنا نسخة قديمة فوق عمله)
 *    ونترك القرار للمستخدم: تحميل الأحدث، أو الإبقاء على نسخة هذا التبويب.
 */
export function CanvasPersistenceProvider({
  workspaceId,
  onReloadLatest,
  children,
}: {
  workspaceId: string
  /** يعيد تحميل المحرر من التخزين (يملكه المكوّن الذي يقرأ اللوحة) */
  onReloadLatest: () => void
  children: ReactNode
}) {
  const store = useCanvasStoreApi()
  const controllerRef = useRef<CanvasPersistence | null>(null)
  const [externalChange, setExternalChange] = useState(false)

  useEffect(() => {
    const sync = createTabSync({
      workspaceId,
      onExternalSave: () => {
        controllerRef.current?.setPaused(true)
        setExternalChange(true)
      },
    })
    const controller = createCanvasPersistence({
      workspaceId,
      store,
      storage,
      onSaved: (summary, contentChanged) => {
        useWorkspaceStore.getState().recordCanvasSummary(workspaceId, summary, contentChanged)
        // تغيير العرض (تحريك/تكبير) لا يستحق إنذار التبويبات الأخرى: لا يمحو محتواها
        if (contentChanged) sync.announceSaved()
      },
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
      sync.dispose()
      controllerRef.current = null
    }
  }, [store, workspaceId])

  const retry = useCallback(() => void controllerRef.current?.retry(), [])
  const keepMine = useCallback(() => {
    setExternalChange(false)
    controllerRef.current?.setPaused(false)
    void controllerRef.current?.flush()
  }, [])
  const reloadLatest = useCallback(() => {
    // الإيقاف يبقى قائماً أثناء إزالة المحرر: حفظ المغادرة لا يكتب فلا تُمحى تعديلات التبويب الآخر
    controllerRef.current?.setPaused(true)
    setExternalChange(false)
    onReloadLatest()
  }, [onReloadLatest])
  const flush = useCallback(async () => {
    await controllerRef.current?.flush()
  }, [])
  const value = useMemo<PersistenceActions>(
    () => ({ retry, externalChange, keepMine, reloadLatest, flush }),
    [retry, externalChange, keepMine, reloadLatest, flush],
  )

  return <PersistenceContext value={value}>{children}</PersistenceContext>
}
