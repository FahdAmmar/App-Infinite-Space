import type { ReactNode } from 'react'
import { Handle, NodeResizeControl, NodeResizer, Position, ResizeControlVariant } from '@xyflow/react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasNodeType } from '../../types/nodes'
import { getResizeLimits } from '../../utils/constants'

/** مقابض الوصل الأربعة: المعرّف هو اسم الجهة، فيُخزَّن في الوصلة ويُستعاد كما هو */
const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

interface NodeFrameProps {
  id: string
  type: CanvasNodeType
  selected: boolean
  /** أثناء تحرير النص نخفي مقابض الحجم كي لا تعترض المؤشر */
  editing?: boolean
  /** المجموعات حاويات لا تُوصل، فلا مقابض لها */
  connectable?: boolean
  /** يُستدعى بعد انتهاء السحب لتغيير الحجم (المجموعات تعيد تقييم أعضائها) */
  onResizeEnd?: () => void
  children: ReactNode
}

/**
 * هيكل مشترك لكل أنواع العقد: يضيف مقابض تغيير الحجم ومقابض الوصل وتمييز «مصدر الوصل المعلّق»،
 * فلا يكرر كل نوع هذا الكود، ويبقى سلوك الأنواع الخمسة متطابقاً.
 * الصور تتغير بالعرض فقط (resizeDirection=horizontal) لأن ارتفاعها يتبع نسبة الصورة،
 * ومقابض حجمها في الزاويتين السفليتين كي لا تغطي مقابض الوصل الواقعة في منتصف الجوانب.
 */
export function NodeFrame({ id, type, selected, editing = false, connectable = true, onResizeEnd, children }: NodeFrameProps) {
  const api = useCanvasStoreApi()
  const isConnectSource = useCanvasStore((state) => state.connectSource === id)
  const limits = getResizeLimits(type)
  const showResize = selected && !editing
  // تغيير الحجم كله خطوة تراجع واحدة؛ والمجموعات تعيد تقييم أعضائها قبل إغلاق الخطوة
  const handleResizeStart = () => api.getState().beginTransaction()
  const handleResizeEnd = () => {
    onResizeEnd?.()
    api.getState().endTransaction()
  }

  return (
    <>
      {type === 'image' ? (
        <>
          <NodeResizeControl
            position="bottom-left"
            variant={ResizeControlVariant.Handle}
            resizeDirection="horizontal"
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
            minWidth={limits.minWidth}
            maxWidth={limits.maxWidth}
            style={{ display: showResize ? undefined : 'none' }}
          />
          <NodeResizeControl
            position="bottom-right"
            variant={ResizeControlVariant.Handle}
            resizeDirection="horizontal"
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
            minWidth={limits.minWidth}
            maxWidth={limits.maxWidth}
            style={{ display: showResize ? undefined : 'none' }}
          />
        </>
      ) : (
        <NodeResizer
          isVisible={showResize}
          minWidth={limits.minWidth}
          minHeight={limits.minHeight}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
        />
      )}
      {connectable &&
        HANDLES.map((handle) => (
          <Handle key={handle.id} id={handle.id} type="source" position={handle.position} className="connect-handle" />
        ))}
      <div className={cn('h-full w-full', isConnectSource && 'connect-source')}>{children}</div>
    </>
  )
}
