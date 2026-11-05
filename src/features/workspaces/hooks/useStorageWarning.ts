import { useEffect } from 'react'
import { describeStorageWarning, readStorageEstimate } from '@/services/persistence/storage-estimate'
import { useUiStore } from '@/stores/ui-store'

/** مرة واحدة لكل جلسة: كي لا يتكرر التنبيه عند كل عودة إلى لوحة التحكم. */
let warned = false

/** ينبّه عند اقتراب امتلاء التخزين، قبل أن يفشل الحفظ فعلاً ويفاجأ المستخدم. */
export function useStorageWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || warned) return
    let cancelled = false
    void readStorageEstimate().then((result) => {
      if (cancelled || warned || !result.supported) return
      const message = describeStorageWarning(result.level, result.ratio)
      if (!message) return
      warned = true
      useUiStore.getState().pushToast(result.level === 'critical' ? 'error' : 'info', message)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
}
