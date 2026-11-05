import {
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignVerticalDistributeCenter,
  type LucideIcon,
} from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { selectSelectedCount } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { alignNodes, distributeNodes, type AlignKind, type DistributeAxis, type Placement } from '../utils/arrange'
import type { CanvasNode } from '../types/nodes'

const ALIGN_BUTTONS: ReadonlyArray<{ kind: AlignKind; label: string; Icon: LucideIcon }> = [
  { kind: 'left', label: 'Align left edges', Icon: AlignStartVertical },
  { kind: 'center', label: 'Align horizontal centers', Icon: AlignCenterVertical },
  { kind: 'right', label: 'Align right edges', Icon: AlignEndVertical },
  { kind: 'top', label: 'Align top edges', Icon: AlignStartHorizontal },
  { kind: 'middle', label: 'Align vertical centers', Icon: AlignCenterHorizontal },
  { kind: 'bottom', label: 'Align bottom edges', Icon: AlignEndHorizontal },
]

const DISTRIBUTE_BUTTONS: ReadonlyArray<{ axis: DistributeAxis; label: string; Icon: LucideIcon }> = [
  { axis: 'horizontal', label: 'Distribute horizontally (3 or more items)', Icon: AlignHorizontalDistributeCenter },
  { axis: 'vertical', label: 'Distribute vertically (3 or more items)', Icon: AlignVerticalDistributeCenter },
]

/** أزرار محاذاة وتوزيع المحدد (تظهر عند تحديد بطاقتين فأكثر). كل ضغطة خطوة تراجع واحدة. */
export function ArrangeButtons() {
  const api = useCanvasStoreApi()
  const count = useCanvasStore(selectSelectedCount)

  const run = (compute: (selected: readonly CanvasNode[], all: readonly CanvasNode[]) => Placement[]) => {
    const { nodes, moveNodes } = api.getState()
    moveNodes(compute(nodes.filter((node) => node.selected), nodes))
  }

  return (
    <>
      <div role="group" aria-label="Align" className="flex items-center gap-0.5">
        {ALIGN_BUTTONS.map(({ kind, label, Icon }) => (
          <IconButton key={kind} label={label} onClick={() => run((selected, all) => alignNodes(selected, all, kind))} className="size-9">
            <Icon className="size-4" aria-hidden="true" />
          </IconButton>
        ))}
      </div>
      <div role="group" aria-label="Distribute" className="flex items-center gap-0.5">
        {DISTRIBUTE_BUTTONS.map(({ axis, label, Icon }) => (
          <IconButton
            key={axis}
            label={label}
            disabled={count < 3}
            onClick={() => run((selected, all) => distributeNodes(selected, all, axis))}
            className="size-9"
          >
            <Icon className="size-4" aria-hidden="true" />
          </IconButton>
        ))}
      </div>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
    </>
  )
}
