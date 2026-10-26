import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'

/**
 * اللحظة الحركية الوحيدة في لوحة التحكم: دخول متدرج للعنوان ثم البطاقات عند أول ظهور للمحتوى.
 *
 * - نحرّك عناصر الغلاف [data-reveal] وليس البطاقة نفسها، لأن البطاقة تملك transition على transform
 *   للتمرير (hover)، والجمع بين الاثنين على نفس الخاصية يسبب تقطعاً.
 * - clearProps يزيل الأنماط المضمّنة بعد الانتهاء فلا يتعارض GSAP مع CSS لاحقاً.
 * - gsap.matchMedia يطبّق الحركة فقط عند عدم تفضيل المستخدم تقليل الحركة، ويتولى التنظيف.
 */
export function useDashboardEntrance(rootRef: RefObject<HTMLElement | null>, ready: boolean): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !ready) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const hero = root.querySelectorAll('[data-reveal="hero"]')
      // نحدّ الحركة بأول 12 بطاقة؛ ما بعدها خارج الشاشة غالباً ولا فائدة من تحريكه
      const cards = Array.from(root.querySelectorAll('[data-reveal="card"]')).slice(0, 12)

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from(hero, { y: 18, opacity: 0, duration: 0.7, stagger: 0.08, clearProps: 'transform,opacity' })
        .from(cards, { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, clearProps: 'transform,opacity' }, '-=0.4')
    })

    return () => mm.revert()
  }, [rootRef, ready])
}
