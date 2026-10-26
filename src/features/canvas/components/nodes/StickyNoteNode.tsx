import { memo, type CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { StickyNote } from '../../types/nodes'
import { STICKY_COLORS } from '../../utils/constants'
import { NodeContentEditor } from './NodeContentEditor'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'

/**
 * ورقة لاصقة. لا تشترك في المخزن إلا في سؤال واحد بدائي («هل أنا قيد التحرير؟»)،
 * وباقي بياناتها تأتي من props، فتُعاد رسمها فقط عند تغيّر بياناتها هي (memo).
 * الألوان تأتي كمتغيرات CSS (--note-*) لتتبدل مع السمة: بطاقة داكنة ملوّنة في الداكن، وورقة ساطعة في الفاتح.
 */
function StickyNoteNodeImpl({ id, data, selected }: NodeProps<StickyNote>) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)
  const paper = STICKY_COLORS[data.color]
  const isEmpty = data.title === '' && data.content === ''

  const startEditing = () => {
    if (api.getState().tool !== 'hand') api.getState().startEditing(id)
  }

  const style = {
    '--note-bg': paper.bg,
    '--note-border': paper.border,
    '--note-ink': paper.ink,
    // لون نص مخصص (إن وُجد) يغلب لون الورقة الافتراضي
    ...(data.textColor ? { color: data.textColor } : {}),
  } as CSSProperties

  return (
    <NodeFrame id={id} type="sticky" selected={selected} editing={isEditing}>
      <div
        onDoubleClick={startEditing}
        style={style}
        className={cn('sticky-note flex h-full w-full flex-col overflow-hidden px-4 py-3.5 text-left', selected && 'sticky-note-selected')}
      >
        {isEditing ? (
          <NodeContentEditor
            initialTitle={data.title}
            initialContent={data.content}
            focusField="content"
            titlePlaceholder="Title (optional)"
            contentPlaceholder="Write something…"
            titleClassName="text-base font-semibold leading-snug"
            contentClassName="text-[0.95rem] leading-relaxed"
            onCommit={(value) => api.getState().updateStickyNote(id, value)}
            onExit={() => api.getState().stopEditing(id)}
          />
        ) : (
          <>
            {data.title !== '' && (
              <p dir="auto" className="text-base leading-snug font-semibold break-words">
                {data.title}
              </p>
            )}
            <p
              dir="auto"
              className={cn(
                'min-h-0 flex-1 overflow-hidden text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap',
                data.title !== '' && 'mt-1.5',
                isEmpty && 'opacity-55',
              )}
            >
              {isEmpty ? 'Double-click to write' : data.content}
            </p>
            <TagChips tags={data.tags} className="mt-2 shrink-0" />
          </>
        )}
      </div>
    </NodeFrame>
  )
}

export const StickyNoteNode = memo(StickyNoteNodeImpl)
