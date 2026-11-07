import { useLayoutEffect, type RefObject } from 'react'
import { EASE_OUT_CUBIC, enterAnimation } from '@/lib/enter-animation'

/**
 * اللحظة الحركية الوحيدة في لوحة التحكم: دخول متدرج للعنوان ثم البطاقات عند أول ظهور للمحتوى.
 *
 * - نحرّك عناصر الغلاف [data-reveal] وليس البطاقة نفسها، لأن البطاقة تملك transition على transform
 *   للتمرير (hover)، والجمع بين الاثنين على نفس الخاصية يسبب تقطعاً.
 * - الحركة تُلغى تلقائياً مع تفضيل تقليل الحركة (انظر enterAnimation).
 */
export function useDashboardEntrance(rootRef: RefObject<HTMLElement | null>, ready: boolean): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !ready) return

    const hero = Array.from(root.querySelectorAll('[data-reveal="hero"]'))
    // نحدّ الحركة بأول 12 بطاقة؛ ما بعدها خارج الشاشة غالباً ولا فائدة من تحريكه
    const cards = Array.from(root.querySelectorAll('[data-reveal="card"]')).slice(0, 12)

    const heroStagger = 0.08
    const heroDuration = 0.7
    const heroEnd = heroDuration + Math.max(0, hero.length - 1) * heroStagger
    const cancelHero = enterAnimation(hero, { y: 18, duration: heroDuration, stagger: heroStagger, easing: EASE_OUT_CUBIC })
    // البطاقات تبدأ قبل نهاية العنوان بـ 0.4 ثانية فيتداخل الدخولان بسلاسة
    const cancelCards = enterAnimation(cards, { y: 24, duration: 0.6, stagger: 0.05, delay: Math.max(0, heroEnd - 0.4), easing: EASE_OUT_CUBIC })

    return () => {
      cancelHero()
      cancelCards()
    }
  }, [rootRef, ready])
}
