import { Panel } from '@xyflow/react'
import { Focus, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { countBranch, resolveFocus } from '../utils/focus-branch'

/**
 * شارة تذكّر بأن «التركيز على فرع» فعّال وكم بطاقة في الفرع، وتتيح إلغاءه (أو Esc حين لا يوجد تحديد).
 * تنزل تحت شارة تصفية الوسم وشريط البحث إن كانا ظاهرين في المكان نفسه كي لا يتراكبا.
 */
export function FocusPill() {
  const api = useCanvasStoreApi()
  // مؤشران رقميان بدل مصفوفة: لا يُعاد رسم الشارة إلا إذا تغيّر الرقم الظاهر
  const inBranch = useCanvasStore((state) => {
    const branch = resolveFocus(state.nodes, state.edges, state.focusId)
    return branch === null ? -1 : countBranch(state.nodes, branch).inBranch
  })
  const total = useCanvasStore((state) => {
    const branch = resolveFocus(state.nodes, state.edges, state.focusId)
    return branch === null ? 0 : countBranch(state.nodes, branch).total
  })
  const stacked = useCanvasStore((state) => state.findOpen || (state.tool !== 'select' && state.tool !== 'hand'))
  const tagActive = useCanvasStore((state) => state.tagFilter !== null)
  if (inBranch < 0) return null

  return (
    <Panel
      position="top-center"
      className={cn(stacked ? (tagActive ? 'mt-[11.5rem]!' : 'mt-[8.5rem]!') : tagActive ? 'mt-[7rem]!' : 'mt-16!')}
    >
      <div className="flex items-center gap-1 rounded-full border border-line bg-raised py-1 pl-4 pr-1 text-sm shadow-pop">
        <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-1.5">
          <Focus className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="font-medium">Focus</span>
          <span className="text-muted">
            · {inBranch} of {total} {total === 1 ? 'card' : 'cards'}
          </span>
        </p>
        <IconButton label="Show all cards (Esc)" onClick={() => api.getState().setFocusId(null)} className="size-8">
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    </Panel>
  )
}
