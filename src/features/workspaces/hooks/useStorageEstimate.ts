import { useCallback, useEffect, useState } from 'react'
import {
  readStorageEstimate,
  requestPersistentStorage,
  type PersistOutcome,
  type StorageEstimateResult,
} from '@/services/persistence/storage-estimate'

/** يقيس التخزين عند الفتح، ويتيح طلب «التخزين الدائم» ثم يعيد القياس ليظهر الأثر الفعلي. */
export function useStorageEstimate() {
  const [estimate, setEstimate] = useState<StorageEstimateResult | null>(null)
  const [outcome, setOutcome] = useState<PersistOutcome | null>(null)

  useEffect(() => {
    let cancelled = false
    void readStorageEstimate().then((result) => {
      if (!cancelled) setEstimate(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const protect = useCallback(async () => {
    setOutcome(await requestPersistentStorage())
    setEstimate(await readStorageEstimate())
  }, [])

  return { estimate, outcome, protect }
}
