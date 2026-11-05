import { useSyncExternalStore } from 'react'

/**
 * يتتبع استعلام وسائط (media query) ويعيد نتيجته الحالية، ويعيد التصيير عند تغيّرها (تدوير الجهاز، تغيير حجم النافذة).
 * لقطة الخادم false كي لا نفترض شاشة عريضة قبل معرفة الحقيقة.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
