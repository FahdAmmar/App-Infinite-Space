import { Panel } from '@xyflow/react'
import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { countCards } from '../utils/tag-filter'

/**
 * شارة تذكّر بأن تصفية وسم فعّالة وكم بطاقة ظهرت، وتتيح إلغاءها (أو Esc حين لا يوجد تحديد).
 * تنزل تحت شريط البحث أو تلميح الأداة إن كانا ظاهرين في المكان نفسه كي لا يتراكبا.
 */
export function TagFilterPill() {
  const api = useCanvasStoreApi()
  const tag = useCanvasStore((state) => state.tagFilter)
  // مؤشران رقميان بدل مصفوفة: لا يُعاد رسم الشارة إلا إذا تغيّر الرقم الظاهر
  const matching = useCanvasStore((state) => (state.tagFilter === null ? 0 : countCards(state.nodes, state.tagFilter).matching))
  const total = useCanvasStore((state) => (state.tagFilter === null ? 0 : countCards(state.nodes, state.tagFilter).total))
  const stacked = useCanvasStore((state) => state.findOpen || (state.tool !== 'select' && state.tool !== 'hand'))
  if (tag === null) return null

  return (
    <Panel position="top-center" className={cn(stacked ? 'mt-[8.5rem]!' : 'mt-16!')}>
      <div className="flex items-center gap-1 rounded-full border border-line bg-raised py-1 pl-4 pr-1 text-sm shadow-pop">
        <p role="status" aria-live="polite" className="min-w-0">
          <span dir="auto" className="font-medium">
            #{tag}
          </span>{' '}
          <span className="text-muted">
            · {matching} of {total} {total === 1 ? 'card' : 'cards'}
          </span>
        </p>
        <IconButton label="Show all cards (Esc)" onClick={() => api.getState().setTagFilter(null)} className="size-8">
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    </Panel>
  )
}
