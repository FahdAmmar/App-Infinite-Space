import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Type } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { TextCard } from '../../types/nodes'
import { NodeContentEditor } from './NodeContentEditor'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'

/**
 * بطاقة نص: بطاقة داكنة بحد رفيع وصف رأس (أيقونة + نوع العقدة) كما في المرجع الأول.
 * أكبر من الورقة اللاصقة وأنسب للفقرات والشروح.
 */
function TextCardNodeImpl({ id, data, selected }: NodeProps<TextCard>) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)
  const isEmpty = data.title === '' && data.content === ''

  const startEditing = () => {
    if (api.getState().tool !== 'hand') api.getState().startEditing(id)
  }

  return (
    <NodeFrame id={id} type="text" selected={selected} editing={isEditing}>
      <div
        onDoubleClick={startEditing}
        className={cn('card-node flex h-full w-full flex-col overflow-hidden px-5 pt-3.5 pb-4 text-left text-ink', selected && 'card-node-selected')}
      >
        <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted">
          <Type className="size-3.5" aria-hidden="true" />
          Text
        </div>

        {isEditing ? (
          <div className="min-h-0 flex-1">
            <NodeContentEditor
              initialTitle={data.title}
              initialContent={data.content}
              focusField="title"
              titlePlaceholder="Title"
              contentPlaceholder="Start writing…"
              titleClassName="text-[1.05rem] font-semibold leading-snug tracking-tight"
              contentClassName="text-[0.92rem] leading-[1.65]"
              onCommit={(value) => api.getState().updateTextCard(id, value)}
              onExit={() => api.getState().stopEditing(id)}
            />
          </div>
        ) : isEmpty ? (
          <p className="text-[0.92rem] text-muted">Double-click to write</p>
        ) : (
          <>
            {data.title !== '' && (
              <p dir="auto" className="text-[1.05rem] leading-snug font-semibold tracking-tight break-words">
                {data.title}
              </p>
            )}
            <p
              dir="auto"
              className={cn(
                'min-h-0 flex-1 overflow-hidden text-[0.92rem] leading-[1.65] break-words whitespace-pre-wrap text-ink/85',
                data.title !== '' && 'mt-1.5',
              )}
            >
              {data.content}
            </p>
            <TagChips tags={data.tags} className="mt-2 shrink-0" />
          </>
        )}
      </div>
    </NodeFrame>
  )
}

export const TextCardNode = memo(TextCardNodeImpl)
