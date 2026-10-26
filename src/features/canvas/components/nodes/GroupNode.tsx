import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { GroupContainer } from '../../types/nodes'
import { GROUP_LABEL_MAX_LENGTH, STICKY_COLORS } from '../../utils/constants'
import { NodeFrame } from './NodeFrame'

/** حقل اسم المجموعة أثناء التحرير: حالة محلية تُرسل مرة واحدة عند الانتهاء (نفس مبدأ محرر العقد). */
function GroupLabelEditor({ initial, onCommit, onExit }: { initial: string; onCommit: (label: string) => void; onExit: () => void }) {
  const [label, setLabel] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = () => {
    const next = label.trim()
    if (next !== initial) onCommit(next)
    onExit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish()
    }
  }

  return (
    <input
      ref={inputRef}
      value={label}
      onChange={(event) => setLabel(event.target.value)}
      onBlur={finish}
      onKeyDown={handleKeyDown}
      maxLength={GROUP_LABEL_MAX_LENGTH}
      placeholder="Group name"
      aria-label="Group name"
      dir="auto"
      autoComplete="off"
      className="nodrag nopan min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:opacity-60"
    />
  )
}

/**
 * إطار مجموعة: منطقة شفافة بحد منقّط وشريط عنوان. السحب من الشريط فقط (dragHandle)،
 * أما جسمها الفارغ فيمرّر السحب للوحة حتى لا تحجب مجموعة كبيرة تحريك اللوحة تحتها.
 * قواعد العضوية في utils/group-utils.ts؛ عند انتهاء تغيير الحجم نعيد تقييم من بداخلها.
 */
function GroupNodeImpl({ id, data, selected }: NodeProps<GroupContainer>) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)
  const paper = STICKY_COLORS[data.color]

  const startEditing = () => {
    if (api.getState().tool !== 'hand') api.getState().startEditing(id)
  }

  return (
    <NodeFrame
      id={id}
      type="group"
      selected={selected}
      editing={isEditing}
      connectable={false}
      onResizeEnd={() => api.getState().reconcileAllMembership()}
    >
      <div
        style={{ '--group-tint': paper.border } as CSSProperties}
        className={cn('canvas-group group-body flex h-full w-full flex-col', selected && 'canvas-group-selected')}
      >
        <div
          className="group-drag-handle flex h-10 shrink-0 items-center gap-2 px-3.5"
          onDoubleClick={(event) => {
            // التحرير فقط؛ لا نترك الحدث يصل للوحة فتُنشئ ورقة لاصقة
            event.stopPropagation()
            startEditing()
          }}
        >
          <Layers className="size-4 shrink-0 opacity-80" aria-hidden="true" />
          {isEditing ? (
            <GroupLabelEditor
              initial={data.label}
              onCommit={(label) => api.getState().updateNodeData(id, 'group', { label })}
              onExit={() => api.getState().stopEditing(id)}
            />
          ) : (
            <span dir="auto" className={cn('min-w-0 flex-1 truncate text-sm font-semibold', data.label === '' && 'opacity-60')}>
              {data.label !== '' ? data.label : 'Group'}
            </span>
          )}
        </div>
      </div>
    </NodeFrame>
  )
}

export const GroupNode = memo(GroupNodeImpl)
