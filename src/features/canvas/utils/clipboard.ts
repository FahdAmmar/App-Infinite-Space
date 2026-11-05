import type { XYPosition } from '@xyflow/react'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { getAbsolutePosition, getNodeSize } from './group-utils'
import { duplicateNodes } from './node-factory'

/**
 * نسخ ولصق البطاقات (بين المساحات أيضاً). الحافظة الداخلية في ذاكرة التبويب، لا في حافظة النظام،
 * لأن البطاقات ليست نصاً؛ لكننا نكتب في حافظة النظام جملة تعريفية قصيرة (انظر CLIPBOARD_MARKER)
 * كي لا تتقدم عليها صورة قديمة نُسخت من خارج التطبيق عند اللصق.
 */

export interface CanvasClipboard {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/** نص حافظة النظام بعد النسخ داخل التطبيق: مقروء إن لُصق في مكان آخر، ويتعرف عليه اللصق هنا. */
export function clipboardMarker(count: number): string {
  return `InfiniteSpace: ${count} ${count === 1 ? 'item' : 'items'} copied`
}

const MARKER_PATTERN = /^InfiniteSpace: \d+ items? copied$/

export function isClipboardMarker(text: string | null | undefined): boolean {
  return typeof text === 'string' && MARKER_PATTERN.test(text.trim())
}

/**
 * يبني حافظة من المحدد: المحدد + أعضاء المجموعات المحددة + الوصلات التي طرفاها كلاهما داخل النسخة.
 * بطاقة محددة داخل مجموعة غير محددة تُحوَّل إلى إحداثيات مطلقة وتُفصل عن مجموعتها:
 * موضعها النسبي لا معنى له خارج مجموعتها (خصوصاً في مساحة أخرى)، وتنضم لمجموعة جديدة عند اللصق إن وقعت داخلها.
 */
export function buildClipboard(allNodes: readonly CanvasNode[], allEdges: readonly CanvasEdge[]): CanvasClipboard | null {
  const selected = allNodes.filter((node) => node.selected)
  if (selected.length === 0) return null

  const byId = new Map(allNodes.map((node) => [node.id, node]))
  const selectedIds = new Set(selected.map((node) => node.id))
  const selectedGroupIds = new Set(selected.filter((node) => node.type === 'group').map((node) => node.id))

  const included = new Map<string, CanvasNode>()
  for (const node of selected) {
    const parentCopied = node.parentId !== undefined && selectedGroupIds.has(node.parentId)
    if (node.parentId !== undefined && !parentCopied) {
      // نبني نسخة بلا parentId دون متغير غير مستعمل (قاعدة lint): التفكيك مع حذف الخاصية
      const detached: CanvasNode = { ...node, position: getAbsolutePosition(node, byId) }
      delete detached.parentId
      included.set(node.id, detached)
    } else {
      included.set(node.id, node)
    }
  }
  for (const node of allNodes) {
    if (node.parentId !== undefined && selectedGroupIds.has(node.parentId) && !selectedIds.has(node.id)) {
      included.set(node.id, node)
    }
  }

  const edges = allEdges.filter((edge) => included.has(edge.source) && included.has(edge.target))
  return { nodes: [...included.values()], edges }
}

/** مركز المستطيل المحيط بالبطاقات الجذرية (غير الأعضاء) في الحافظة، بإحداثيات اللوحة. */
export function clipboardCenter(clip: CanvasClipboard): XYPosition {
  const roots = clip.nodes.filter((node) => node.parentId === undefined)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of roots) {
    const { width, height } = getNodeSize(node)
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }
  return roots.length === 0 ? { x: 0, y: 0 } : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * نسخ جاهزة للصق: معرّفات جديدة، ومركزها عند `target`. أعضاء المجموعات يحتفظون بمواضعهم النسبية
 * (تتحرك معهم مجموعتهم)، والوصلات تُعاد توجيهها إلى النسخ.
 */
export function preparePaste(clip: CanvasClipboard, target: XYPosition, now: number): CanvasClipboard {
  const center = clipboardCenter(clip)
  const dx = target.x - center.x
  const dy = target.y - center.y
  const roots = clip.nodes.filter((node) => node.parentId === undefined)
  const copy = duplicateNodes(roots, clip.nodes, clip.edges, now, 0)
  const nodes = copy.nodes.map((node) =>
    node.parentId === undefined ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } } : node,
  )
  return { nodes, edges: copy.edges }
}

// ───────── الحافظة الداخلية (ذاكرة التبويب) ─────────

let held: CanvasClipboard | null = null

export function setHeldClipboard(clip: CanvasClipboard | null): void {
  held = clip
}

export function getHeldClipboard(): CanvasClipboard | null {
  return held
}
