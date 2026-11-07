import { Panel } from '@xyflow/react'
import { Check, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useCanvasStore } from '@/stores/canvas-store-context'
import { useUiStore } from '@/stores/ui-store'
import { checklistKey, stepsFromKey } from '../utils/first-run'

/**
 * قائمة «البدء السريع»: أربع خطوات تُشطب وحدها وتختفي حين تكتمل أو يغلقها المستخدم (مرة واحدة لكل المساحات).
 * مكانها أسفل اليسار لا أعلاه: أعلى اللوحة هو موضع النقر المزدوج لإنشاء البطاقات الأول، ولا نريد قائمة تعترضه
 * (اكتُشف حين فشلت فحوصات المتصفح القديمة التي تنقر هناك). تُخفى على الهاتف (يكفيه إرشاد اللوحة الفارغة)
 * وعلى الشاشات القصيرة حيث تتزاحم مع شريط الأدوات الجانبي.
 */
export function FirstRunChecklist() {
  const key = useCanvasStore((state) => checklistKey(state.nodes, state.edges))
  const dismissed = useUiStore((state) => state.checklistDismissed)
  const outlineOpen = useCanvasStore((state) => state.outlineOpen)
  if (key === null || dismissed || outlineOpen) return null
  const steps = stepsFromKey(key)

  return (
    <Panel position="bottom-left" className="mb-[calc(2.25rem+var(--safe-bottom))]! max-sm:hidden [@media(max-height:560px)]:hidden">
      <section aria-label="Getting started" className="w-60 rounded-2xl border border-line bg-surface/90 p-3 shadow-pop backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h2 className="px-1 text-sm font-semibold">Getting started</h2>
          <IconButton label="Hide the getting started list" onClick={() => useUiStore.getState().dismissChecklist()} className="size-7">
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <ul className="mt-1.5 space-y-0.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm">
              <span
                aria-hidden="true"
                className={cn('grid size-5 shrink-0 place-items-center rounded-full border', step.done ? 'border-success bg-success text-bg' : 'border-line')}
              >
                {step.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className={cn(step.done && 'text-muted line-through')}>{step.label}</span>
              <span className="sr-only">{step.done ? '(done)' : '(not done yet)'}</span>
            </li>
          ))}
        </ul>
      </section>
    </Panel>
  )
}
