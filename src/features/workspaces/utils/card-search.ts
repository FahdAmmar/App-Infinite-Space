import type { CanvasNode } from '@/features/canvas/types/nodes'
import { findMatches } from '@/features/canvas/utils/find'
import { nodeLabel } from '@/features/canvas/utils/outline'

/** مساحة بمحتواها كما يحتاجه البحث (تُبنى محلياً من التخزين؛ لا شيء يخرج من المتصفح). */
export interface SearchableWorkspace {
  id: string
  name: string
  nodes: readonly CanvasNode[]
}

export interface CardHit {
  workspaceId: string
  workspaceName: string
  nodeId: string
  label: string
  kind: CanvasNode['type']
}

/** أقصى نتائج تُعرض: القائمة الطويلة لا تفيد، والمستخدم يضيّق بالكتابة. */
export const MAX_CARD_HITS = 30

/**
 * بحث في بطاقات كل المساحات بقواعد البحث على اللوحة نفسها (بلا حساسية للحالة والتشكيل، «#وسم» للوسوم).
 * الترتيب: المساحات بالترتيب المعطى (الأحدث أولاً عادةً)، وداخل كل مساحة بترتيب القراءة.
 */
export function searchCards(index: readonly SearchableWorkspace[], query: string, limit = MAX_CARD_HITS): CardHit[] {
  if (query.trim() === '') return []
  const hits: CardHit[] = []
  for (const workspace of index) {
    const byId = new Map(workspace.nodes.map((node) => [node.id, node]))
    for (const id of findMatches(workspace.nodes, query)) {
      const node = byId.get(id)
      if (!node) continue
      hits.push({ workspaceId: workspace.id, workspaceName: workspace.name, nodeId: id, label: nodeLabel(node), kind: node.type })
      if (hits.length >= limit) return hits
    }
  }
  return hits
}
