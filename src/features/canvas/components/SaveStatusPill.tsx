import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { AlertTriangle, Check, Loader2, RotateCw } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas-store-context'
import { usePersistence } from '../persistence/persistence-context'

const REASONS = {
  quota: 'The browser storage is full.',
  unavailable: 'The browser blocked storage (private mode or a permission setting).',
  unknown: 'The browser could not write the data.',
} as const

function timeLabel(at: number | null): string {
  return at === null ? '' : ` at ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * حالة الحفظ في الشريط العلوي (مواصفات 4.6): محفوظ / جارٍ الحفظ / فشل مع إعادة المحاولة.
 * role="status" يجعل قارئ الشاشة يعلن التغيير دون مقاطعة. عند الفشل نذكر السبب ونُعلم أن العمل باقٍ في الذاكرة فقط.
 */
export function SaveStatusPill() {
  const status = useCanvasStore((state) => state.saveStatus)
  const { retry } = usePersistence()
  const checkRef = useRef<SVGSVGElement>(null)
  const previousKind = useRef(status.kind)

  // نبضة صغيرة على علامة الصح عند الانتقال من «جارٍ الحفظ» إلى «محفوظ» فقط (تأكيد بصري)؛ لا عند أول عرض ولا عند التحميل.
  // نحرّك الأيقونة وحدها (بلا transition في CSS لها) ويُلغى التتبع عند الإزالة، وتُعطَّل مع تقليل الحركة.
  useEffect(() => {
    const was = previousKind.current
    previousKind.current = status.kind
    const icon = checkRef.current
    if (status.kind !== 'saved' || was === 'saved' || !icon) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(icon, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)', clearProps: 'transform,opacity' })
    })
    return () => mm.revert()
  }, [status.kind])
  const base = 'flex h-11 items-center gap-1.5 rounded-full border bg-surface px-3.5 text-xs shadow-pop sm:px-4'

  if (status.kind === 'error') {
    return (
      <div role="status" className={`${base} border-danger/60 text-ink`}>
        <AlertTriangle className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
        <span className="hidden sm:inline" title={`${REASONS[status.reason]} Your changes stay on screen but are not saved.`}>
          Not saved
        </span>
        <button
          type="button"
          onClick={retry}
          aria-label="Retry saving"
          title={`${REASONS[status.reason]} Your changes stay on screen but are not saved. Click to retry.`}
          className="-mr-1 ml-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-accent transition-colors hover:bg-raised"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  if (status.kind === 'saving' || status.kind === 'unsaved') {
    return (
      <div role="status" className={`${base} border-line text-muted`} title="Saving to this browser…">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="hidden sm:inline">{status.kind === 'saving' ? 'Saving…' : 'Unsaved changes'}</span>
        <span className="sr-only sm:hidden">Saving</span>
      </div>
    )
  }

  return (
    <div role="status" className={`${base} border-line text-muted`} title={`All changes are saved in this browser${timeLabel(status.at)}.`}>
      <Check ref={checkRef} className="size-3.5 text-success" aria-hidden="true" />
      <span className="hidden sm:inline">Saved</span>
      <span className="sr-only sm:hidden">Saved</span>
    </div>
  )
}
