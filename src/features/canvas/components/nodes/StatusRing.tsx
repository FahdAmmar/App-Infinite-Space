import { memo } from 'react'
import { Check } from 'lucide-react'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CardStatus } from '../../types/nodes'

const STATUS_LABELS: Record<CardStatus, string> = { none: 'No status', doing: 'In progress', done: 'Done' }

/**
 * دائرة الحالة في زاوية البطاقة (مرجع Kinopio): نقرة واحدة تنقلها لا شيء ← قيد العمل ← تم.
 * زر حقيقي يعمل بلوحة المفاتيح، وnodrag كي لا تبدأ النقرة سحب البطاقة. الحالة تظهر بالشكل (نصف ممتلئ/علامة صح)
 * لا باللون وحده.
 */
function StatusRingImpl({ id, status }: { id: string; status: CardStatus }) {
  const api = useCanvasStoreApi()
  return (
    <button
      type="button"
      data-status={status}
      aria-label={`Status: ${STATUS_LABELS[status]}. Activate to change.`}
      title={`${STATUS_LABELS[status]} — click to change`}
      className="status-ring nodrag nopan"
      onClick={(event) => {
        event.stopPropagation()
        api.getState().cycleNodeStatus(id)
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {status === 'done' && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
      {status === 'doing' && <span aria-hidden="true" className="status-ring-half" />}
    </button>
  )
}

export const StatusRing = memo(StatusRingImpl)
