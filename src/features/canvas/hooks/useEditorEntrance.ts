import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'

/**
 * دخول المحرر (مواصفات 10: «workspace entry»): أدوات الواجهة العائمة تنزلق إلى مكانها وتظهر بالتدريج.
 *
 * قواعد منع التعارض (مواصفات 11):
 *  - نحرّك عناصر الواجهة العائمة فقط ([data-reveal]) داخل Panels؛ لا اللوحة ولا عقدها ولا مرئي React Flow
 *    (تلك تملك transform خاصاً بها).
 *  - لا transition على opacity/transform في هذه العناصر في CSS.
 *  - clearProps يزيل الأنماط المضمّنة بعد الانتهاء، وgsap.matchMedia يعطّل الحركة مع تفضيل تقليلها ويتولى التنظيف.
 */
export function useEditorEntrance(rootRef: RefObject<HTMLElement | null>, ready: boolean): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !ready) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const top = root.querySelectorAll('[data-reveal="top"]')
      const left = root.querySelectorAll('[data-reveal="left"]')
      const bottom = root.querySelectorAll('[data-reveal="bottom"]')
      const clear = { clearProps: 'transform,opacity' }
      gsap
        .timeline({ defaults: { ease: 'power3.out', duration: 0.55 } })
        .from(top, { y: -14, opacity: 0, stagger: 0.06, ...clear })
        .from(left, { x: -16, opacity: 0, ...clear }, '-=0.4')
        .from(bottom, { y: 16, opacity: 0, ...clear }, '-=0.45')
    })
    return () => mm.revert()
  }, [rootRef, ready])
}
