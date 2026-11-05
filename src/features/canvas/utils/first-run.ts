import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'

/**
 * قائمة «البدء السريع» على اللوحة: ما يجب أن يعرفه من يفتح التطبيق أول مرة، وتُشطب خطواتها وحدها
 * حين يفعلها المستخدم (تُشتق من حالة اللوحة، فلا حالة مكررة تُحفظ ولا تنفصل عن الواقع).
 */
export const CHECKLIST_STEPS = [
  { id: 'add', label: 'Add a card' },
  { id: 'connect', label: 'Connect two cards' },
  { id: 'tag', label: 'Give a card a tag' },
  { id: 'group', label: 'Frame cards with a group' },
] as const

export type ChecklistStepId = (typeof CHECKLIST_STEPS)[number]['id']

/**
 * فوق هذا العدد من العناصر يكون صاحب اللوحة قد تجاوز مرحلة التعلم، فلا نزعجه بقائمة بداية.
 * (ويحمي الأداء أيضاً: لا نمسح لوحة كبيرة عند كل تحديث للمخزن.)
 */
export const CHECKLIST_MAX_NODES = 8

function isDone(id: ChecklistStepId, nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): boolean {
  switch (id) {
    case 'add':
      return nodes.some((node) => node.type !== 'group')
    case 'connect':
      return edges.length > 0
    case 'tag':
      return nodes.some((node) => node.data.tags.length > 0)
    case 'group':
      return nodes.some((node) => node.type === 'group')
  }
}

/**
 * مفتاح نصي مثل '1010' (خطوة منجزة = 1) أو null حين لا تُعرض القائمة (لوحة كبيرة أو كل الخطوات منجزة).
 * نصٌّ بدل مصفوفة كي يعيد اشتراك المخزن الرسم فقط حين تتغير نتيجة فعلاً.
 */
export function checklistKey(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): string | null {
  if (nodes.length > CHECKLIST_MAX_NODES) return null
  const flags = CHECKLIST_STEPS.map((step) => isDone(step.id, nodes, edges))
  return flags.every(Boolean) ? null : flags.map((done) => (done ? '1' : '0')).join('')
}

export function stepsFromKey(key: string): { id: ChecklistStepId; label: string; done: boolean }[] {
  return CHECKLIST_STEPS.map((step, index) => ({ ...step, done: key[index] === '1' }))
}
