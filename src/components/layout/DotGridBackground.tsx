import { useEffect, useRef } from 'react'

/**
 * خلفية شبكة النقاط الثابتة. على الأجهزة ذات المؤشر الدقيق (فأرة) تضيء النقاط حول المؤشر.
 * الحركة زخرفية فقط، لذا تُعطَّل مع تفضيل تقليل الحركة وعلى شاشات اللمس.
 * المستمع على window مع passive والتحديث عبر requestAnimationFrame كي لا يؤثر على الأداء.
 */
export function DotGridBackground() {
  const litRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lit = litRef.current
    if (!lit) return
    const canTrack =
      window.matchMedia('(pointer: fine)').matches && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    if (!canTrack) return

    let frame = 0
    let x = 0
    let y = 0
    const handleMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        lit.style.setProperty('--mx', `${x}px`)
        lit.style.setProperty('--my', `${y}px`)
        lit.style.opacity = '1'
      })
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div className="dot-grid absolute inset-0" />
      <div ref={litRef} className="dot-grid-lit absolute inset-0 opacity-0 transition-opacity duration-700" />
    </div>
  )
}
