import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'

/**
 * بطاقة تظهر بعد التحميل الأول (نسخ مساحة مثلاً) تدخل بحركة قصيرة كي يلاحظها المستخدم وسط الشبكة.
 * الدخول المتدرج الأول يتولاه useDashboardEntrance، فنتجاهل المعرّفات الموجودة أصلاً عند أول رسم.
 * نحرّك عنصر الغلاف <li data-workspace-id> وليس البطاقة (التي تملك transition على transform عند المرور).
 */
export function useNewCardEnter(listRef: RefObject<HTMLElement | null>, ids: readonly string[], ready: boolean): void {
  const seen = useRef<Set<string> | null>(null)

  useLayoutEffect(() => {
    if (!ready) return
    const known = seen.current
    seen.current = new Set(ids)
    const list = listRef.current
    if (known === null || !list) return // أول رسم: لا حركة هنا
    const fresh = ids.filter((id) => !known.has(id))
    if (fresh.length === 0) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = Array.from(list.querySelectorAll<HTMLElement>('[data-workspace-id]')).filter((el) =>
        fresh.includes(el.dataset.workspaceId ?? ''),
      )
      gsap.from(targets, { y: 20, scale: 0.96, opacity: 0, duration: 0.5, ease: 'back.out(1.6)', clearProps: 'transform,opacity' })
    })
    return () => mm.revert()
  }, [listRef, ids, ready])
}
