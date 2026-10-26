import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'

/**
 * مقارنة «المحتوى» لا «الحالة اللحظية». React Flow يعيد إنشاء كائنات العقد عند كل تحديد أو سحب
 * أو قياس، لكن هذه ليست تغييرات يجب حفظها أو تسجيلها في سجل التراجع. لذلك نقارن فقط ما يُحفظ فعلاً:
 * المعرّف والنوع والموضع (بالقيمة) والحجم والمجموعة الأم وبيانات العقدة (بالمرجع: كل تعديل يُنشئ كائن data جديداً).
 * المقارنة O(n) بلا تسلسل JSON، فهي رخيصة بما يكفي لتُجرى عند كل تغيير في المخزن.
 */
export function nodesContentEqual(a: readonly CanvasNode[], b: readonly CanvasNode[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (x === undefined || y === undefined) return false
    if (
      x.id !== y.id ||
      x.type !== y.type ||
      x.data !== y.data ||
      x.width !== y.width ||
      x.height !== y.height ||
      x.parentId !== y.parentId ||
      x.position.x !== y.position.x ||
      x.position.y !== y.position.y
    ) {
      return false
    }
  }
  return true
}

export function edgesContentEqual(a: readonly CanvasEdge[], b: readonly CanvasEdge[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (x === undefined || y === undefined) return false
    if (
      x.id !== y.id ||
      x.source !== y.source ||
      x.target !== y.target ||
      x.sourceHandle !== y.sourceHandle ||
      x.targetHandle !== y.targetHandle ||
      x.data !== y.data
    ) {
      return false
    }
  }
  return true
}

/** هل غيّرت هذه التعديلات شيئاً قابلاً للحفظ؟ */
export function canvasContentEqual(
  a: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
  b: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
): boolean {
  return nodesContentEqual(a.nodes, b.nodes) && edgesContentEqual(a.edges, b.edges)
}
