import type { CanvasNode } from '../types/nodes'

export type LayerMove = 'front' | 'back'

/**
 * ترتيب الطبقات = ترتيب مصفوفة العقد (React Flow يرسم بالترتيب، والمحفوظ يحفظه كما هو، فلا حاجة لحقل جديد).
 * قاعدة ثابتة في المشروع: المجموعات أولاً دائماً (خلف العناصر، والأب قبل أبنائه)، لذا يُرتَّب كل قسم على حدة
 * ولا تتجاوز بطاقة مجموعةً أبداً. يعيد المصفوفة نفسها إن لم يتغير شيء (فلا يُسجَّل تراجع ولا حفظ بلا فائدة).
 */
export function reorderLayers(nodes: readonly CanvasNode[], ids: ReadonlySet<string>, move: LayerMove): CanvasNode[] {
  const arrange = (items: CanvasNode[]): CanvasNode[] => {
    const picked = items.filter((node) => ids.has(node.id))
    const rest = items.filter((node) => !ids.has(node.id))
    return move === 'front' ? [...rest, ...picked] : [...picked, ...rest]
  }
  const next = [...arrange(nodes.filter((node) => node.type === 'group')), ...arrange(nodes.filter((node) => node.type !== 'group'))]
  return next.every((node, index) => node === nodes[index]) ? (nodes as CanvasNode[]) : next
}
