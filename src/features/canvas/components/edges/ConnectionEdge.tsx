import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react'
import { cn } from '@/lib/cn'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasEdge } from '../../types/edges'
import { DEFAULT_EDGE_DATA, EDGE_COLORS } from '../../utils/constants'

const DASH: Record<'solid' | 'dashed' | 'dotted', string | undefined> = {
  solid: undefined,
  dashed: '9 7',
  dotted: '1 8',
}

/**
 * وصلة بين عقدتين. نقطتا الطرفين يحسبهما React Flow من مقابض العقدتين، فتتبعهما الوصلة أثناء السحب
 * (هذا ما يميزها عن خطوط SVG مرسومة يدوياً بإحداثيات ثابتة).
 *
 * التدرج: linearGradient بوحدات userSpaceOnUse من المصدر إلى الهدف. لو استخدمنا الوحدات الافتراضية
 * (objectBoundingBox) لاختفى الخط الأفقي أو العمودي تماماً لأن صندوقه بلا ارتفاع أو عرض.
 * الأسهم: علامة (marker) لكل طرف بلون ذلك الطرف، و orient="auto-start-reverse" يقلب سهم البداية تلقائياً.
 * المعرّفات تحمل id الوصلة كي لا تتصادم بين وصلات تعرّف علامات بالاسم نفسه.
 */
function ConnectionEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<CanvasEdge>) {
  const api = useCanvasStoreApi()
  const style = data ?? DEFAULT_EDGE_DATA
  const colors = EDGE_COLORS[style.color]
  const geometry = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }

  const [path, labelX, labelY] =
    style.curve === 'straight'
      ? getStraightPath(geometry)
      : style.curve === 'step'
        ? getSmoothStepPath({ ...geometry, borderRadius: 14 })
        : getBezierPath(geometry)

  const gradientId = `edge-gradient-${id}`
  const startMarkerId = `edge-arrow-start-${id}`
  const endMarkerId = `edge-arrow-end-${id}`
  const hasStartArrow = style.arrow === 'start' || style.arrow === 'both'
  const hasEndArrow = style.arrow === 'end' || style.arrow === 'both'
  const strokeWidth = selected ? 3 : 2

  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
        <marker id={startMarkerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={colors.from} />
        </marker>
        <marker id={endMarkerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={colors.to} />
        </marker>
      </defs>

      <BaseEdge
        id={id}
        path={path}
        interactionWidth={26}
        markerStart={hasStartArrow ? `url(#${startMarkerId})` : undefined}
        markerEnd={hasEndArrow ? `url(#${endMarkerId})` : undefined}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth,
          strokeDasharray: DASH[style.lineStyle],
          strokeLinecap: 'round',
        }}
      />

      {/* نقطة في منتصف الوصلة المحددة (مرجع 3): تدل على أنها قابلة للتحرير من لوحة الخصائص */}
      {selected && <circle cx={labelX} cy={labelY} r={5} className="edge-midpoint" />}

      {style.label !== '' && (
        <EdgeLabelRenderer>
          <button
            type="button"
            data-compact
            onClick={() => api.getState().selectEdge(id)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            dir="auto"
            className={cn('edge-label nodrag nopan', selected && 'edge-label-selected')}
          >
            {style.label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const ConnectionEdge = memo(ConnectionEdgeImpl)
