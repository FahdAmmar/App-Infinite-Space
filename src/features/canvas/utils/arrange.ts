import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types/nodes'
import { getAbsolutePosition, getNodeSize } from './group-utils'

/**
 * محاذاة وتوزيع البطاقات المحددة. كل الحساب بالإحداثيات المطلقة ثم يُحوَّل لموضع كل بطاقة في فضائها
 * (نسبي لمجموعتها إن كانت عضواً). المرجع هو المستطيل المحيط بالمحدد نفسه، كما في أدوات التصميم المعروفة.
 */

export type AlignKind = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

export interface Placement {
  id: string
  position: XYPosition
}

interface Box {
  node: CanvasNode
  x: number
  y: number
  width: number
  height: number
  /** الموضع المطلق لأصل فضاء البطاقة (مجموعتها)، لتحويل المطلق إلى النسبي */
  origin: XYPosition
}

/** عضو في مجموعة محددة معها يتحرك بتحرك مجموعته: لا يُحاذى منفصلاً وإلا اختلّ موضعه داخلها. */
function toBoxes(selected: readonly CanvasNode[], all: readonly CanvasNode[]): Box[] {
  const byId = new Map(all.map((node) => [node.id, node]))
  const selectedIds = new Set(selected.map((node) => node.id))
  return selected
    .filter((node) => !(node.parentId !== undefined && selectedIds.has(node.parentId)))
    .map((node) => {
      const absolute = getAbsolutePosition(node, byId)
      const { width, height } = getNodeSize(node)
      return { node, x: absolute.x, y: absolute.y, width, height, origin: { x: absolute.x - node.position.x, y: absolute.y - node.position.y } }
    })
}

const EPSILON = 0.01

function placementsFor(boxes: readonly Box[], target: ReadonlyMap<string, XYPosition>): Placement[] {
  const result: Placement[] = []
  for (const box of boxes) {
    const next = target.get(box.node.id)
    if (!next) continue
    const position = { x: next.x - box.origin.x, y: next.y - box.origin.y }
    if (Math.abs(position.x - box.node.position.x) > EPSILON || Math.abs(position.y - box.node.position.y) > EPSILON) {
      result.push({ id: box.node.id, position })
    }
  }
  return result
}

export function alignNodes(selected: readonly CanvasNode[], all: readonly CanvasNode[], kind: AlignKind): Placement[] {
  const boxes = toBoxes(selected, all)
  if (boxes.length < 2) return []
  const minX = Math.min(...boxes.map((b) => b.x))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))

  const target = new Map<string, XYPosition>()
  for (const box of boxes) {
    const next = { x: box.x, y: box.y }
    if (kind === 'left') next.x = minX
    else if (kind === 'right') next.x = maxX - box.width
    else if (kind === 'center') next.x = (minX + maxX) / 2 - box.width / 2
    else if (kind === 'top') next.y = minY
    else if (kind === 'bottom') next.y = maxY - box.height
    else next.y = (minY + maxY) / 2 - box.height / 2
    target.set(box.node.id, next)
  }
  return placementsFor(boxes, target)
}

/** يوزّع ثلاث بطاقات فأكثر بفراغات متساوية بينها؛ الأولى والأخيرة تبقيان مكانهما. */
export function distributeNodes(selected: readonly CanvasNode[], all: readonly CanvasNode[], axis: DistributeAxis): Placement[] {
  const boxes = toBoxes(selected, all)
  if (boxes.length < 3) return []
  const horizontal = axis === 'horizontal'
  const start = (box: Box) => (horizontal ? box.x : box.y)
  const size = (box: Box) => (horizontal ? box.width : box.height)
  const ordered = [...boxes].sort((a, b) => start(a) - start(b))
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  if (!first || !last) return []

  const span = start(last) + size(last) - start(first)
  const used = ordered.reduce((sum, box) => sum + size(box), 0)
  const gap = (span - used) / (ordered.length - 1)

  const target = new Map<string, XYPosition>()
  let cursor = start(first)
  for (const box of ordered) {
    target.set(box.node.id, horizontal ? { x: cursor, y: box.y } : { x: box.x, y: cursor })
    cursor += size(box) + gap
  }
  return placementsFor(boxes, target)
}
