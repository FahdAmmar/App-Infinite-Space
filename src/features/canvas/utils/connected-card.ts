import type { XYPosition } from '@xyflow/react'
import type { CanvasEdge, HandleSide } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { createEdge } from './edge-utils'
import { NODE_SIZES } from './constants'
import { createStickyNote } from './node-factory'

/** أقل مسافة سحب (بكسل شاشة) تُعدّ سحباً مقصوداً: دونها نقرة على المقبض لا نريد منها بطاقة. */
export const MIN_CONNECTED_DRAG_PX = 28

const OPPOSITE: Record<HandleSide, HandleSide> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }

export function oppositeSide(side: HandleSide): HandleSide {
  return OPPOSITE[side]
}

export function isIntentionalDrag(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= MIN_CONNECTED_DRAG_PX
}

/**
 * مركز البطاقة الجديدة بحيث يقع حدّها المقابل للمقبض عند نقطة الإفلات تماماً (بدل أن تتمركز على المؤشر
 * فتتداخل مع البطاقة الأصلية عند إفلات قريب): تبدو البطاقة كأنها «خرجت» من المقبض إلى حيث توقف المؤشر.
 */
export function newCardCenter(drop: XYPosition, fromSide: HandleSide): XYPosition {
  const { width, height } = NODE_SIZES.sticky
  switch (fromSide) {
    case 'right':
      return { x: drop.x + width / 2, y: drop.y }
    case 'left':
      return { x: drop.x - width / 2, y: drop.y }
    case 'bottom':
      return { x: drop.x, y: drop.y + height / 2 }
    case 'top':
      return { x: drop.x, y: drop.y - height / 2 }
  }
}

/**
 * ورقة جديدة موصولة بالبطاقة المسحوب منها: الوصلة من الأصل إلى الجديدة، بمقبض خروج هو الذي بدأ منه السحب
 * ومقبض دخول مقابل له. دالة نقية كي يُختبر الموضع والاتجاه دون واجهة؛ المخزن يضيفهما معاً في خطوة تراجع واحدة.
 */
export function planConnectedCard(
  from: CanvasNode,
  fromSide: HandleSide,
  drop: XYPosition,
  now: number,
): { node: CanvasNode; edge: CanvasEdge } {
  const node = createStickyNote(newCardCenter(drop, fromSide), now)
  return { node, edge: createEdge(from.id, node.id, fromSide, oppositeSide(fromSide)) }
}
