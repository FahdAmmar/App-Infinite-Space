import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'

/** صنف يُضاف إلى ما يُخفَّت؛ يستهدفه CSS ولا يدخل في البيانات المحفوظة (يُشتق وقت الرسم فقط). */
export const DIMMED_CLASS = 'is-dimmed'

/** الوسوم لا تفرّق بين حالة الأحرف (مثل addTag): Design و design وسم واحد. */
export function nodeMatchesTag(node: CanvasNode, tag: string): boolean {
  const needle = tag.toLowerCase()
  return node.data.tags.some((existing) => existing.toLowerCase() === needle)
}

/**
 * المجموعات حاويات بنيوية: تبقى ظاهرة دائماً كي يبقى مكان بطاقاتها المطابقة مفهوماً،
 * فالتخفيت يخص البطاقات التي لا تحمل الوسم فقط.
 */
export function isDimmed(node: CanvasNode, tag: string): boolean {
  return node.type !== 'group' && !nodeMatchesTag(node, tag)
}

/** عدد البطاقات (دون المجموعات) المطابقة والإجمالي، لعرض «3 من 12». */
export function countCards(nodes: readonly CanvasNode[], tag: string): { matching: number; total: number } {
  let matching = 0
  let total = 0
  for (const node of nodes) {
    if (node.type === 'group') continue
    total += 1
    if (nodeMatchesTag(node, tag)) matching += 1
  }
  return { matching, total }
}

export interface TagCount {
  tag: string
  count: number
}

/** كل وسوم اللوحة بعدد بطاقات كل منها (دمج حالة الأحرف، وتُعرض بأول كتابة)، الأكثر استعمالاً أولاً. */
export function collectTags(nodes: readonly CanvasNode[]): TagCount[] {
  const byKey = new Map<string, TagCount>()
  for (const node of nodes) {
    // وسم مكرر في بطاقة واحدة (بحالتين مختلفتين) يُعد مرة واحدة لها
    const seen = new Set<string>()
    for (const tag of node.data.tags) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const entry = byKey.get(key)
      if (entry) entry.count += 1
      else byKey.set(key, { tag, count: 1 })
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

// نسخة مخفّتة لكل عقدة، تُعاد بالهوية نفسها ما دامت العقدة لم تتغير: React Flow لا يعيد رسم عقدة لم يتغير كائنها،
// فتبقى كلفة السحب على لوحة كبيرة مع تصفية فعّالة قريبة من كلفتها دون تصفية.
const dimmedVariants = new WeakMap<CanvasNode, CanvasNode>()

function withDimmedClass(node: CanvasNode): CanvasNode {
  const cached = dimmedVariants.get(node)
  if (cached) return cached
  const variant = { ...node, className: node.className ? `${node.className} ${DIMMED_CLASS}` : DIMMED_CLASS }
  dimmedVariants.set(node, variant)
  return variant
}

/** العقد كما تُرسم أثناء التخفيت: ما تُرجع له القاعدة true مخفّت، والباقي كما هو (نفس الكائن). */
export function dimNodesWhere(nodes: readonly CanvasNode[], shouldDim: (node: CanvasNode) => boolean): CanvasNode[] {
  return nodes.map((node) => (shouldDim(node) ? withDimmedClass(node) : node))
}

/** الوصلة تبقى واضحة فقط إن كان طرفاها ظاهرين؛ وصلة إلى بطاقة مخفّتة تُخفَّت معها. */
export function dimEdgesWhere(
  edges: readonly CanvasEdge[],
  nodes: readonly CanvasNode[],
  shouldDim: (node: CanvasNode) => boolean,
): CanvasEdge[] {
  const dimmedIds = new Set(nodes.filter(shouldDim).map((node) => node.id))
  return edges.map((edge) => {
    if (!dimmedIds.has(edge.source) && !dimmedIds.has(edge.target)) return edge
    return { ...edge, className: edge.className ? `${edge.className} ${DIMMED_CLASS}` : DIMMED_CLASS }
  })
}

/** العقد كما تُرسم أثناء التصفية: غير المطابقة مخفّتة، والمطابقة والمجموعات كما هي (نفس الكائن). */
export function dimNodes(nodes: readonly CanvasNode[], tag: string): CanvasNode[] {
  return dimNodesWhere(nodes, (node) => isDimmed(node, tag))
}

export function dimEdges(edges: readonly CanvasEdge[], nodes: readonly CanvasNode[], tag: string): CanvasEdge[] {
  return dimEdgesWhere(edges, nodes, (node) => isDimmed(node, tag))
}
