import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

interface NetworkInformationLike {
  saveData?: boolean
}

/**
 * هل يجوز تشغيل الحركة الزخرفية الثقيلة (WebGL) الآن؟ لا في حالتين:
 *  - المستخدم فضّل تقليل الحركة (نتابع تغيّر التفضيل أثناء الجلسة).
 *  - المستخدم فعّل «توفير البيانات» في المتصفح (خاصية غير قياسية، نقرأها إن وُجدت).
 */
export function useEffectsAllowed(): boolean {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  return !reduced && connection?.saveData !== true
}
