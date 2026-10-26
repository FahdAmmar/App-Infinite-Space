import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

interface BorderBeamProps {
  /** طول الشعاع بالبكسل */
  size?: number
  /** مدة دورة كاملة بالثواني */
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
}

/**
 * Border Beam — تأثير شعاع ضوئي يدور على حدود عنصر.
 * مقتبس من مكتبة Magic UI (ترخيص MIT، https://magicui.design) ومكتوب بدون مكتبة حركة:
 * الشعاع عنصر يتحرك على مسار مستطيل بخاصية CSS offset-path، فالحركة كلها على الـ compositor
 * (لا JavaScript ولا إعادة تخطيط). يعمل داخل عنصر أبّ position: relative بحدود مستديرة.
 * إن لم يدعم المتصفح offset-path: rect() يُخفى التأثير فقط (انظر index.css). ويُخفى مع تقليل الحركة.
 */
export function BorderBeam({
  size = 90,
  duration = 7,
  delay = 0,
  colorFrom = 'var(--edge-from)',
  colorTo = 'var(--edge-to)',
  className,
}: BorderBeamProps) {
  return (
    <div aria-hidden="true" className="border-beam-frame pointer-events-none absolute inset-0 rounded-[inherit]">
      <div
        className={cn('border-beam', className)}
        style={
          {
            '--beam-size': `${size}px`,
            '--beam-duration': `${duration}s`,
            '--beam-delay': `-${delay}s`,
            '--beam-from': colorFrom,
            '--beam-to': colorTo,
          } as CSSProperties
        }
      />
    </div>
  )
}
