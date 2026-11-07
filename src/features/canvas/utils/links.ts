import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { nodeLabel } from './outline'

/** سطر في لوحة «الروابط»: البطاقة على الطرف الآخر من الوصلة، ونص الوصلة إن وُجد. */
export interface LinkEntry {
  edgeId: string
  nodeId: string
  label: string
  edgeLabel: string
}

export interface NodeLinks {
  /** وصلات تخرج من البطاقة (هي المصدر) */
  outgoing: LinkEntry[]
  /** وصلات تصل إلى البطاقة (هي الهدف) */
  incoming: LinkEntry[]
}

/**
 * الوصلات الداخلة والخارجة لبطاقة (مرجع لوحة Links في Scrintal)، للتنقل بينها بنقرة.
 * وصلة تشير إلى بطاقة محذوفة تُهمل (لا يُعرض سطر بلا وجهة). الترتيب ثابت: بترتيب الوصلات في اللوحة.
 */
export function getNodeLinks(nodeId: string, nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): NodeLinks {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing: LinkEntry[] = []
  const incoming: LinkEntry[] = []
  for (const edge of edges) {
    if (edge.source === nodeId && edge.target !== nodeId) {
      const other = byId.get(edge.target)
      if (other) outgoing.push({ edgeId: edge.id, nodeId: other.id, label: nodeLabel(other), edgeLabel: edge.data?.label ?? '' })
    } else if (edge.target === nodeId && edge.source !== nodeId) {
      const other = byId.get(edge.source)
      if (other) incoming.push({ edgeId: edge.id, nodeId: other.id, label: nodeLabel(other), edgeLabel: edge.data?.label ?? '' })
    }
  }
  return { outgoing, incoming }
}
