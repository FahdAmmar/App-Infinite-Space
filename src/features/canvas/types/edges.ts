import type { Edge } from '@xyflow/react'

/**
 * نموذج الوصلات. كل وصلة من نوع واحد ('connection') وبياناتها تصف شكلها فقط؛
 * أما نقطتا البداية والنهاية فيحسبهما React Flow من موضع العقدتين، فتتبعهما الوصلة أثناء السحب تلقائياً.
 */

export const EDGE_COLOR_IDS = ['gradient', 'violet', 'pink', 'blue', 'green', 'amber', 'neutral'] as const
export type EdgeColorId = (typeof EDGE_COLOR_IDS)[number]

export const EDGE_CURVES = ['curved', 'straight', 'step'] as const
export type EdgeCurve = (typeof EDGE_CURVES)[number]

export const EDGE_LINE_STYLES = ['solid', 'dashed', 'dotted'] as const
export type EdgeLineStyle = (typeof EDGE_LINE_STYLES)[number]

/** 'end' سهم عند الهدف، 'start' عند المصدر، 'both' الاثنان، 'none' خط بلا أسهم */
export const EDGE_ARROWS = ['end', 'start', 'both', 'none'] as const
export type EdgeArrow = (typeof EDGE_ARROWS)[number]

export type CanvasEdgeData = {
  curve: EdgeCurve
  lineStyle: EdgeLineStyle
  arrow: EdgeArrow
  color: EdgeColorId
  label: string
}

export type CanvasEdge = Edge<CanvasEdgeData, 'connection'>

/** جهات المقابض الأربع في كل عقدة */
export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type HandleSide = (typeof HANDLE_SIDES)[number]
