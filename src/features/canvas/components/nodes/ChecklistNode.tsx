import { memo, useRef } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ListChecks, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { createId } from '@/lib/id'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { ChecklistCard, ChecklistItem } from '../../types/nodes'
import {
  addChecklistItem,
  checklistProgress,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from '../../utils/checklist'
import { CHECKLIST_LIMITS, TITLE_MAX_LENGTH } from '../../utils/constants'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'
import { useEditingFocus } from './useEditingFocus'

/**
 * بطاقة قائمة مهام (مراجع Scrintal وKinopio وMiro): تُعلَّم العناصر وتُحرَّر في مكانها دون وضع تحرير منفصل،
 * وشريط التقدّم يلخّص المنجز. كل تغيير يمر بفعل واحد في المخزن (خطوة تراجع واحدة).
 * الحقول حقول عادية بـ defaultValue والمفتاح يتضمن القيمة المخزنة، فيعيد التراجع رسمها بالقيمة الصحيحة؛
 * وتُحفَظ القيمة عند فقدان التركيز أو Enter، و Esc يتراجع عن التعديل، فلا تُسجَّل خطوة تراجع لكل ضغطة مفتاح.
 */
function ChecklistNodeImpl({ id, data, selected }: NodeProps<ChecklistCard>) {
  const api = useCanvasStoreApi()
  const addRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const { isEditing, onBlur } = useEditingFocus(id, titleRef)
  const progress = checklistProgress(data.items)
  const setItems = (items: readonly ChecklistItem[]) => {
    if (items !== data.items) api.getState().updateNodeData(id, 'checklist', { items: [...items] })
  }

  const commitTitle = (value: string) => {
    const title = value.trim().slice(0, TITLE_MAX_LENGTH)
    if (title !== data.title) api.getState().updateNodeData(id, 'checklist', { title })
  }
  const addFromInput = () => {
    const input = addRef.current
    if (!input) return
    const next = addChecklistItem(data.items, input.value, createId())
    if (next !== data.items) {
      setItems(next)
      input.value = ''
    }
  }
  const full = data.items.length >= CHECKLIST_LIMITS.maxItems

  return (
    <NodeFrame id={id} type="checklist" selected={selected} editing={isEditing} status={data.status ?? 'none'} locked={data.locked === true}>
      <div onBlur={onBlur} className={cn('card-node flex h-full w-full flex-col overflow-hidden px-4 pt-3.5 pb-3 text-left text-ink', selected && 'card-node-selected')}>
        <div className="mb-2 flex items-center gap-2 pe-6">
          <ListChecks className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={titleRef}
            key={`title-${data.title}`}
            dir="auto"
            defaultValue={data.title}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="Checklist"
            aria-label="Checklist title"
            onBlur={(event) => commitTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                event.currentTarget.value = data.title
                event.currentTarget.blur()
              }
            }}
            className="nodrag nopan min-w-0 flex-1 bg-transparent text-[1.0rem] font-semibold tracking-tight outline-none placeholder:text-muted focus-visible:underline"
          />
          {progress.total > 0 && (
            <span className="shrink-0 text-xs text-muted tabular-nums" aria-hidden="true">
              {progress.done}/{progress.total}
            </span>
          )}
        </div>

        {progress.total > 0 && (
          <div
            role="progressbar"
            aria-label="Checklist progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-valuetext={`${progress.done} of ${progress.total} done`}
            className="mb-2.5 h-1.5 shrink-0 overflow-hidden rounded-full bg-raised"
          >
            <div className="checklist-progress h-full rounded-full" style={{ width: `${progress.percent}%` }} />
          </div>
        )}

        <ul className="nodrag nopan nowheel min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {data.items.map((item) => (
            <li key={item.id} className="group/item flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => setItems(toggleChecklistItem(data.items, item.id))}
                aria-label={`Done: ${item.text}`}
                className="size-4 shrink-0 cursor-pointer accent-[var(--status-done)]"
              />
              <input
                key={`${item.id}-${item.text}`}
                dir="auto"
                defaultValue={item.text}
                maxLength={CHECKLIST_LIMITS.itemMaxLength}
                aria-label="Item text"
                onBlur={(event) => setItems(renameChecklistItem(data.items, item.id, event.currentTarget.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    event.currentTarget.value = item.text
                    event.currentTarget.blur()
                  }
                }}
                className={cn('min-w-0 flex-1 bg-transparent py-0.5 text-[0.9rem] outline-none focus-visible:underline', item.done && 'text-ink/50 line-through')}
              />
              <button
                type="button"
                data-compact
                aria-label={`Remove: ${item.text}`}
                title="Remove item"
                onClick={() => setItems(removeChecklistItem(data.items, item.id))}
                className="grid size-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-danger focus-visible:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <input
          ref={addRef}
          dir="auto"
          maxLength={CHECKLIST_LIMITS.itemMaxLength}
          disabled={full}
          placeholder={full ? `Limit of ${CHECKLIST_LIMITS.maxItems} items reached` : '+ Add item (Enter)'}
          aria-label="Add a checklist item"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addFromInput()
            } else if (event.key === 'Escape') {
              event.currentTarget.value = ''
              event.currentTarget.blur()
            }
          }}
          onBlur={addFromInput}
          className="nodrag nopan mt-1.5 w-full shrink-0 border-t border-line bg-transparent pt-2 text-[0.88rem] outline-none placeholder:text-muted focus-visible:border-accent"
        />
        <TagChips tags={data.tags} className="mt-1.5 shrink-0" />
      </div>
    </NodeFrame>
  )
}

export const ChecklistNode = memo(ChecklistNodeImpl)
