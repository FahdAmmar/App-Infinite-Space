import { useEffect, type RefObject } from 'react'

/**
 * Magic Card (Magic UI، ترخيص MIT): بقعة ضوء ناعمة تتبع المؤشر داخل البطاقة.
 * الرسم نفسه في CSS (.magic-card)؛ هنا نكتب إحداثيي المؤشر في متغيرين فقط، عبر requestAnimationFrame
 * وعلى هذا العنصر وحده، فلا إعادة رسم لـ React ولا أثر على بقية الصفحة.
 * يُفعَّل مع المؤشر الدقيق (فأرة) فقط وعند عدم طلب تقليل الحركة؛ وإلا تبقى البطاقة بهيئتها العادية.
 */
export function useSpotlight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const canTrack =
      window.matchMedia('(pointer: fine)').matches && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    if (!canTrack) return

    let frame = 0
    let x = 0
    let y = 0
    const handleMove = (event: PointerEvent): void => {
      const rect = element.getBoundingClientRect()
      x = event.clientX - rect.left
      y = event.clientY - rect.top
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        element.style.setProperty('--spot-x', `${x}px`)
        element.style.setProperty('--spot-y', `${y}px`)
      })
    }
    element.addEventListener('pointermove', handleMove, { passive: true })
    return () => {
      element.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
