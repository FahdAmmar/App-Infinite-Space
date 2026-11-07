/**
 * دخول متدرج بواجهة Web Animations الأصلية بدل GSAP في لوحة التحكم: تخرج GSAP (نحو 27KB مضغوطة)
 * من الحزمة الأولى فتبقى في حزمة المحرر الكسولة فقط حيث تُستخدم فعلاً.
 *
 * - fill 'backwards' يثبّت الإطار الأول خلال التأخير، وبعد الانتهاء تعود الأنماط لما يحدده CSS (لا حاجة لـ clearProps).
 * - تفضيل تقليل الحركة، أو بيئة بلا Element.animate (jsdom)، يعني عدم تحريك شيء.
 */
export interface EnterOptions {
  y: number
  scale?: number
  duration: number
  stagger: number
  /** تأخير البداية بالثواني قبل أول عنصر */
  delay?: number
  easing: string
}

// المنحنيات المكافئة لـ power3.out و back.out(1.6) في GSAP
export const EASE_OUT_CUBIC = 'cubic-bezier(0.215, 0.61, 0.355, 1)'
export const EASE_BACK_OUT = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** يشغّل الدخول على العناصر ويعيد دالة تلغيها (للتنظيف عند إلغاء التأثير). */
export function enterAnimation(targets: readonly Element[], options: EnterOptions): () => void {
  if (prefersReducedMotion()) return () => {}
  const running: Animation[] = []
  targets.forEach((element, index) => {
    if (typeof element.animate !== 'function') return
    const from = `translateY(${options.y}px)${options.scale === undefined ? '' : ` scale(${options.scale})`}`
    running.push(
      element.animate(
        [
          { opacity: 0, transform: from },
          { opacity: 1, transform: 'none' },
        ],
        {
          duration: options.duration * 1000,
          delay: ((options.delay ?? 0) + index * options.stagger) * 1000,
          easing: options.easing,
          fill: 'backwards',
        },
      ),
    )
  })
  return () => running.forEach((animation) => animation.cancel())
}
