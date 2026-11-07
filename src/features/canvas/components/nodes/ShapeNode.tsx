import { memo, useRef, type CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { ShapeCard, ShapeKind } from '../../types/nodes'
import { STICKY_COLORS, TITLE_MAX_LENGTH } from '../../utils/constants'
import { NodeFrame } from './NodeFrame'

/** الشكل نفسه: SVG بإحداثيات 0-100 يتمدد مع البطاقة، وvector-effect يُبقي سماكة الخط ثابتة مهما كان الحجم */
function ShapeOutline({ shape }: { shape: ShapeKind }) {
  const common = { fill: 'var(--shape-bg)', stroke: 'var(--shape-border)', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
      {shape === 'rectangle' && <rect x="1" y="1" width="98" height="98" rx="5" {...common} />}
      {shape === 'ellipse' && <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />}
      {shape === 'diamond' && <polygon points="50,1 99,50 50,99 1,50" {...common} />}
    </svg>
  )
}

/**
 * شكل هندسي بنص اختياري في وسطه (مرجع Miro). النقر المزدوج أو F2 يفتح تحرير النص؛ يُحفظ عند فقدان التركيز أو Ctrl/⌘+Enter،
 * و Esc يتراجع. النص داخل الشكل ينحصر في المنطقة الداخلية (أضيق في الإهليلج والمعيّن) كي لا يخرج من حدوده.
 */
function ShapeNodeImpl({ id, data, selected }: NodeProps<ShapeCard>) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const paper = STICKY_COLORS[data.color]
  const style = { '--shape-bg': paper.bg, '--shape-border': paper.border, color: paper.ink } as CSSProperties
  const inset = data.shape === 'rectangle' ? 'inset-3' : data.shape === 'ellipse' ? 'inset-x-[14%] inset-y-[14%]' : 'inset-x-[25%] inset-y-[25%]'

  const commit = (value: string) => {
    const label = value.trim().slice(0, TITLE_MAX_LENGTH)
    if (label !== data.label) api.getState().updateNodeData(id, 'shape', { label })
    api.getState().stopEditing(id)
  }

  return (
    <NodeFrame id={id} type="shape" selected={selected} editing={isEditing} status={data.status ?? 'none'} locked={data.locked === true}>
      <div
        style={style}
        onDoubleClick={() => {
          if (api.getState().tool !== 'hand') api.getState().startEditing(id)
        }}
        className={cn('shape-node relative h-full w-full', selected && 'shape-node-selected')}
      >
        <ShapeOutline shape={data.shape} />
        <div className={cn('absolute grid place-items-center text-center', inset)}>
          {isEditing ? (
            <textarea
              ref={areaRef}
              autoFocus
              dir="auto"
              defaultValue={data.label}
              maxLength={TITLE_MAX_LENGTH}
              aria-label="Shape text"
              onFocus={(event) => event.currentTarget.select()}
              onBlur={(event) => commit(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.value = data.label
                  event.currentTarget.blur()
                } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.currentTarget.blur()
                }
              }}
              className="nodrag nopan nowheel size-full resize-none bg-transparent text-center text-[0.95rem] leading-snug outline-none"
            />
          ) : (
            data.label !== '' && (
              <p dir="auto" className="line-clamp-6 text-[0.95rem] leading-snug font-medium break-words">
                {data.label}
              </p>
            )
          )}
        </div>
      </div>
    </NodeFrame>
  )
}

export const ShapeNode = memo(ShapeNodeImpl)
