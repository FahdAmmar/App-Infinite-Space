import type { XYPosition } from '@xyflow/react'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { CARD_STATUSES } from '../types/nodes'
import { getStatus } from './card-flags'
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

const TREE_GAP_X = 56
const TREE_GAP_Y = 24
const COLUMN_GAP = 32
/** أقصى عمق تُرسم به الشجرة بالتداخل؛ ما بعده يبدأ شجرة جديدة، فلا يفيض مكدّس الاستدعاءات مع سلسلة طويلة جداً */
const MAX_TREE_DEPTH = 400

const readingOrder = (a: Box, b: Box): number => a.y - b.y || a.x - b.x

/** الشجرة والأعمدة تعمل على البطاقات فقط (المجموعات حاويات لها تنسيقها الخاص). */
function cardBoxes(selected: readonly CanvasNode[], all: readonly CanvasNode[]): Box[] {
  return toBoxes(selected, all).filter((box) => box.node.type !== 'group')
}

function bounds(boxes: readonly Box[]): { left: number; top: number } {
  return { left: Math.min(...boxes.map((box) => box.x)), top: Math.min(...boxes.map((box) => box.y)) }
}

/**
 * يرتّب المحدد أعمدة بحسب الحالة (لا شيء | قيد العمل | تم) كلوحة Kanban، من الزاوية العليا اليسرى للمحدد.
 * داخل كل عمود يبقى الترتيب الأصلي من الأعلى إلى الأسفل. الأعمدة الثلاثة تحتفظ بمكانها حتى لو فرغ أحدها.
 */
export function layoutColumnsByStatus(selected: readonly CanvasNode[], all: readonly CanvasNode[]): Placement[] {
  const boxes = cardBoxes(selected, all)
  if (boxes.length < 2) return []
  const { left, top } = bounds(boxes)
  const columnWidth = Math.max(...boxes.map((box) => box.width))
  const target = new Map<string, XYPosition>()
  CARD_STATUSES.forEach((status, index) => {
    let y = top
    for (const box of boxes.filter((candidate) => getStatus(candidate.node) === status).sort(readingOrder)) {
      target.set(box.node.id, { x: left + index * (columnWidth + COLUMN_GAP), y })
      y += box.height + TREE_GAP_Y
    }
  })
  return placementsFor(boxes, target)
}

/**
 * يرتّب المحدد شجرةً (خريطة ذهنية) من اليسار إلى اليمين تتبع الوصلات بين البطاقات المحددة: الجذور هي ما لا يصله سهم
 * من المحدد، والأبناء بترتيب مواضعهم الحالي، والأب يتوسط أبناءه. الدورات والآباء المتعددون لا يعلّقان الحساب:
 * كل بطاقة تُوضع مرة واحدة تحت أول أب يبلغها. وصلات خارج المحدد تُتجاهل.
 */
export function layoutTree(selected: readonly CanvasNode[], all: readonly CanvasNode[], edges: readonly CanvasEdge[]): Placement[] {
  const boxes = cardBoxes(selected, all)
  if (boxes.length < 2) return []
  const byId = new Map(boxes.map((box) => [box.node.id, box]))
  const children = new Map<string, Box[]>()
  const hasParent = new Set<string>()
  for (const edge of edges) {
    const from = byId.get(edge.source)
    const to = byId.get(edge.target)
    if (!from || !to || from === to) continue
    const list = children.get(from.node.id) ?? []
    if (!list.includes(to)) list.push(to)
    children.set(from.node.id, list)
    hasParent.add(to.node.id)
  }
  for (const list of children.values()) list.sort(readingOrder)

  const { left, top } = bounds(boxes)
  const placed = new Set<string>()
  const slots: Array<{ box: Box; depth: number; centerY: number }> = []
  const widths: number[] = []
  let cursor = top

  const place = (box: Box, depth: number): number => {
    placed.add(box.node.id)
    const centers: number[] = []
    for (const kid of children.get(box.node.id) ?? []) {
      if (placed.has(kid.node.id) || depth + 1 > MAX_TREE_DEPTH) continue
      centers.push(place(kid, depth + 1))
    }
    let centerY: number
    if (centers.length === 0) {
      centerY = cursor + box.height / 2
      cursor += box.height + TREE_GAP_Y
    } else {
      centerY = ((centers[0] as number) + (centers[centers.length - 1] as number)) / 2
      // أب أطول من كتلة أبنائه لا يتداخل مع الشجرة التالية في العمود نفسه
      cursor = Math.max(cursor, centerY + box.height / 2 + TREE_GAP_Y)
    }
    slots.push({ box, depth, centerY })
    widths[depth] = Math.max(widths[depth] ?? 0, box.width)
    return centerY
  }

  const ordered = [...boxes].sort(readingOrder)
  for (const root of ordered.filter((box) => !hasParent.has(box.node.id))) place(root, 0)
  // ما بقي غير موضوع جزء من دورة (كل بطاقة فيه لها أب): نبدأ منه شجرة جديدة
  for (const box of ordered) if (!placed.has(box.node.id)) place(box, 0)

  const columnX: number[] = []
  widths.forEach((width, depth) => {
    columnX[depth] = depth === 0 ? left : (columnX[depth - 1] as number) + (widths[depth - 1] as number) + TREE_GAP_X
    void width
  })
  const target = new Map<string, XYPosition>()
  for (const { box, depth, centerY } of slots) target.set(box.node.id, { x: columnX[depth] as number, y: centerY - box.height / 2 })
  return placementsFor(boxes, target)
}
