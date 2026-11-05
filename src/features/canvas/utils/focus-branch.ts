import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { isDimmed } from './tag-filter'

/**
 * «التركيز على فرع»: بطاقة وكل ما يسبقها وما يليها على طول اتجاه الوصلات (المصدر ← الهدف).
 * نمشي في كل اتجاه على حدة، فلا تدخل «الأخوات» (بطاقة تشاركك سلفاً فقط) ولا ما يصل إليك عبر اتجاه معاكس.
 * حالة عرض فقط: تُشتق وقت الرسم ولا تُحفظ ولا تدخل في التراجع.
 */
export function collectBranch(edges: readonly CanvasEdge[], startId: string): Set<string> {
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source])
  }

  const branch = new Set<string>([startId])
  const walk = (next: ReadonlyMap<string, string[]>): void => {
    // كل اتجاه له مجموعة زيارة مستقلة: دورة (A→B→A) لا تُدخلنا في حلقة لا تنتهي
    const seen = new Set<string>([startId])
    const queue = [startId]
    // for-of على مصفوفة يرى العناصر المضافة أثناء الدوران: هذه طابور BFS بلا فهرسة
    for (const current of queue) {
      for (const id of next.get(current) ?? []) {
        if (seen.has(id)) continue
        seen.add(id)
        branch.add(id)
        queue.push(id)
      }
    }
  }
  walk(outgoing)
  walk(incoming)
  return branch
}

/** الفرع المعروض فعلاً، أو null إن لم يكن هناك تركيز أو حُذفت البطاقة المركَّز عليها. */
export function resolveFocus(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  focusId: string | null,
): Set<string> | null {
  if (focusId === null || !nodes.some((node) => node.id === focusId)) return null
  return collectBranch(edges, focusId)
}

/** عدد بطاقات الفرع (دون المجموعات) والإجمالي، لعرض «4 من 12». */
export function countBranch(nodes: readonly CanvasNode[], branch: ReadonlySet<string>): { inBranch: number; total: number } {
  let inBranch = 0
  let total = 0
  for (const node of nodes) {
    if (node.type === 'group') continue
    total += 1
    if (branch.has(node.id)) inBranch += 1
  }
  return { inBranch, total }
}

/**
 * قاعدة التخفيت حين يجتمع وسم وتركيز: تُخفَّت البطاقة إن أخرجها أيٌّ منهما.
 * المجموعات لا تُخفَّت أبداً (تبقى حاويات مفهومة المكان)، كما في تصفية الوسم.
 * تعيد null حين لا شيء فعّال، فلا تكلّف الرسم شيئاً.
 */
export function viewDimming(
  tag: string | null,
  branch: ReadonlySet<string> | null,
): ((node: CanvasNode) => boolean) | null {
  if (tag === null && branch === null) return null
  return (node) => (tag !== null && isDimmed(node, tag)) || (branch !== null && node.type !== 'group' && !branch.has(node.id))
}
