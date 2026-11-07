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

/** جهاز ضعيف (ذاكرة 2GB فأقل أو نواتان فأقل): المشهد زخرفي بحت فلا نستهلك معالجه ولا بطاريته. */
export function isLowEndDevice(nav: Navigator = navigator): boolean {
  const memory = (nav as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = nav.hardwareConcurrency
  return (memory !== undefined && memory <= 2) || (typeof cores === 'number' && cores > 0 && cores <= 2)
}

/**
 * هل يجوز تشغيل الحركة الزخرفية الثقيلة (WebGL) الآن؟ لا في ثلاث حالات:
 *  - المستخدم فضّل تقليل الحركة (نتابع تغيّر التفضيل أثناء الجلسة).
 *  - المستخدم فعّل «توفير البيانات» في المتصفح (خاصية غير قياسية، نقرأها إن وُجدت).
 *  - الجهاز ضعيف (انظر isLowEndDevice).
 */
export function useEffectsAllowed(): boolean {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  return !reduced && connection?.saveData !== true && !isLowEndDevice()
}
