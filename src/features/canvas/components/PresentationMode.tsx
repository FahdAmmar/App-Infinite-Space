import { useEffect, useRef } from 'react'
import { Panel, useReactFlow, type Viewport } from '@xyflow/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { slideRect, slideTitle, stepSlide, type SlideStep } from '../utils/presentation'

/** مدة الانتقال بين الشرائح؛ المستخدمون الذين يفضلون تقليل الحركة ينتقلون فوراً. */
function motionDuration(ms: number): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'n', 'N'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])

/**
 * وضع العرض: كل مجموعة شريحة، والكاميرا تطير من واحدة إلى التي بعدها. الواجهة المحيطة تُخفى (انظر CanvasEditor)
 * والتحرير يُعطَّل، ولا يبقى سوى شريط تحكم صغير. عند الخروج يعود العرض إلى ما كان عليه قبل البدء.
 * لوحة المفاتيح تُلتقط كلها في مرحلة الالتقاط فلا تصل اختصارات التحرير (حذف، تراجع...) إلى اللوحة أثناء العرض؛
 * اختصارات المتصفح بـ Ctrl/⌘ (تكبير الصفحة، إعادة التحميل) تُترك له.
 */
export function PresentationMode() {
  const api = useCanvasStoreApi()
  const flow = useReactFlow<CanvasNode, CanvasEdge>()
  const presentation = useCanvasStore((state) => state.presentation)
  const active = presentation !== null
  const index = presentation?.index ?? 0
  const slideCount = presentation?.slideIds.length ?? 0
  const slideId = presentation?.slideIds[index]
  const nextRef = useRef<HTMLButtonElement>(null)
  const savedViewport = useRef<Viewport | null>(null)

  // البداية: نحفظ العرض الحالي ونضع التركيز على «التالي»؛ النهاية: نستعيد العرض ونعيد التركيز إلى اللوحة
  useEffect(() => {
    if (!active) return
    savedViewport.current = flow.getViewport()
    nextRef.current?.focus()
    return () => {
      const viewport = savedViewport.current
      savedViewport.current = null
      if (viewport) void flow.setViewport(viewport, { duration: motionDuration(350) })
      document.getElementById('canvas-main')?.focus()
    }
  }, [active, flow])

  // تحريك الكاميرا إلى الشريحة الحالية
  useEffect(() => {
    if (!slideId) return
    const group = api.getState().nodes.find((node) => node.id === slideId)
    if (!group) return
    void flow.fitBounds(slideRect(group), { padding: 0.12, duration: motionDuration(650) })
  }, [slideId, api, flow])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      // اختصارات المتصفح بـ Ctrl/⌘ تبقى له، لكن لا تصل إلى اللوحة (تراجع، حذف، لوحة الأوامر...)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        event.stopPropagation()
        return
      }
      const onButton = event.target instanceof HTMLButtonElement
      // زر ذو تركيز يستجيب لـ Enter وSpace بنفسه، وTab يتنقل بين أزرار الشريط
      if (onButton && (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab')) {
        event.stopPropagation()
        return
      }
      const move = (step: SlideStep) => {
        const state = api.getState()
        if (state.presentation) state.setSlideIndex(stepSlide(state.presentation.index, state.presentation.slideIds.length, step))
      }
      // ما نعالجه نمنع سلوكه الافتراضي (تمرير الصفحة بالمسافة مثلاً)؛ ما سواه لا يصل إلى اللوحة لكن يبقى للمتصفح (F5...)
      let handled = true
      if (event.key === 'Escape') api.getState().endPresentation()
      else if (NEXT_KEYS.has(event.key)) move(1)
      else if (PREVIOUS_KEYS.has(event.key)) move(-1)
      else if (event.key === 'Home') move('first')
      else if (event.key === 'End') move('last')
      else handled = false
      if (handled) event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, api])

  if (!presentation || !slideId) return null
  const group = api.getState().nodes.find((node) => node.id === slideId)
  const title = group ? slideTitle(group, index) : `Slide ${index + 1}`
  const step = (by: SlideStep) => api.getState().setSlideIndex(stepSlide(index, slideCount, by))

  return (
    <Panel position="bottom-center" className="mb-5!">
      <section aria-label="Presentation controls" className="flex items-center gap-1 rounded-full border border-line bg-raised p-1 shadow-pop">
        <IconButton label="Previous slide (←)" onClick={() => step(-1)} disabled={index === 0} className="size-10">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </IconButton>
        <p className="min-w-28 max-w-[50vw] px-2 text-center text-sm" dir="auto">
          <span className="block truncate font-medium">{title}</span>
          <span className="block text-xs text-muted">
            {index + 1} / {slideCount}
          </span>
        </p>
        <button
          ref={nextRef}
          type="button"
          aria-label="Next slide (→)"
          title="Next slide (→)"
          onClick={() => step(1)}
          disabled={index === slideCount - 1}
          className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-surface disabled:opacity-40"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
        <IconButton label="Exit presentation (Esc)" onClick={() => api.getState().endPresentation()} className="size-10">
          <X className="size-5" aria-hidden="true" />
        </IconButton>
      </section>
      <p role="status" aria-live="polite" className="sr-only">
        Slide {index + 1} of {slideCount}: {title}
      </p>
    </Panel>
  )
}
