import type { Connection } from '@xyflow/react'
import { createId } from '@/lib/id'
import type { CanvasEdge, CanvasEdgeData, HandleSide } from '../types/edges'
import { HANDLE_SIDES } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { DEFAULT_EDGE_DATA } from './constants'
import { getAbsolutePosition, getNodeSize } from './group-utils'

export type ConnectionCheck = { ok: true } | { ok: false; reason: string }

/**
 * قواعد الوصل المسموحة (مكان واحد تستعمله كل الطرق: السحب من المقابض، أداة الوصل، التحقق أثناء السحب):
 *  - العقدتان موجودتان، ومختلفتان (لا وصلة من عقدة إلى نفسها).
 *  - المجموعات حاويات للتنظيم لا عقد معرفة، فلا تُوصل.
 *  - لا وصلة مكررة بنفس الاتجاه (الاتجاه المعاكس مسموح: أ→ب و ب→أ علاقتان مختلفتان).
 */
export function checkConnection(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  source: string | null | undefined,
  target: string | null | undefined,
): ConnectionCheck {
  if (!source || !target) return { ok: false, reason: 'Pick two items to connect.' }
  if (source === target) return { ok: false, reason: 'An item cannot be connected to itself.' }
  const from = nodes.find((node) => node.id === source)
  const to = nodes.find((node) => node.id === target)
  if (!from || !to) return { ok: false, reason: 'One of the items no longer exists.' }
  if (from.type === 'group' || to.type === 'group') {
    return { ok: false, reason: 'Groups organize items and cannot be connected. Connect the items inside instead.' }
  }
  if (edges.some((edge) => edge.source === source && edge.target === target)) {
    return { ok: false, reason: 'These items are already connected in that direction.' }
  }
  return { ok: true }
}

/**
 * يختار جهتي المقابض المتقابلتين عند الوصل بدون سحب (أداة الوصل): الجهة الأقرب لاتجاه العقدة الأخرى،
 * فتخرج الوصلة من الجانب الذي تتجه إليه بدل أن تلتف حول البطاقة.
 */
export function pickHandleSides(
  from: CanvasNode,
  to: CanvasNode,
  byId: ReadonlyMap<string, CanvasNode>,
): { sourceHandle: HandleSide; targetHandle: HandleSide } {
  const a = getAbsolutePosition(from, byId)
  const b = getAbsolutePosition(to, byId)
  const sizeA = getNodeSize(from)
  const sizeB = getNodeSize(to)
  const dx = b.x + sizeB.width / 2 - (a.x + sizeA.width / 2)
  const dy = b.y + sizeB.height / 2 - (a.y + sizeA.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy >= 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' }
}

export function isHandleSide(value: string | null | undefined): value is HandleSide {
  return HANDLE_SIDES.some((side) => side === value)
}

export function createEdge(
  source: string,
  target: string,
  sourceHandle: HandleSide,
  targetHandle: HandleSide,
  data: Partial<CanvasEdgeData> = {},
): CanvasEdge {
  return {
    id: createId(),
    type: 'connection',
    source,
    target,
    sourceHandle,
    targetHandle,
    data: { ...DEFAULT_EDGE_DATA, ...data },
  }
}

/** من اتصال React Flow (سحب بين مقبضين) إلى وصلة؛ مقبض غير معروف يُستبدل بجهة افتراضية. */
export function edgeFromConnection(connection: Connection): CanvasEdge {
  const sourceHandle = isHandleSide(connection.sourceHandle) ? connection.sourceHandle : 'right'
  const targetHandle = isHandleSide(connection.targetHandle) ? connection.targetHandle : 'left'
  return createEdge(connection.source, connection.target, sourceHandle, targetHandle)
}
