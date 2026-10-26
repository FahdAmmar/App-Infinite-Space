import { useSyncExternalStore } from 'react'

// ساعة مشتركة تُحدَّث كل دقيقة: كل البطاقات تقرأ نفس المؤقت بدل مؤقت لكل بطاقة،
// وتبقى دوال العرض نقية (لا نستدعي Date.now() أثناء الرسم).
const TICK_MS = 60_000
const listeners = new Set<() => void>()
let current = Date.now()
let timer: number | undefined

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = Date.now()
    timer = window.setInterval(() => {
      current = Date.now()
      listeners.forEach((notify) => notify())
    }, TICK_MS)
  }
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.clearInterval(timer)
  }
}

const getSnapshot = (): number => current

/** الوقت الحالي (ms) يتجدد كل دقيقة لتحديث نصوص مثل "3 minutes ago". */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
