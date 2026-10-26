import type { XYPosition } from '@xyflow/react'
import type { CanvasNode, GroupContainer } from '../types/nodes'
import { isGroupNode } from '../types/nodes'
import { NODE_SIZES } from './constants'

/**
 * سلوك المجموعات (النسخة الأولى) — القواعد كلها في هذا الملف كي تُختبر بمعزل عن الواجهة:
 *
 * 1. العضوية بالمركز: تصبح العقدة عضواً في مجموعة إذا وقع مركزها داخل حدود المجموعة عند انتهاء السحب
 *    أو الإنشاء. تخرج منها إذا غادر مركزها. (قاعدة المركز أوضح من «أي تداخل» وتعطي نتيجة متوقعة.)
 * 2. تحريك المجموعة يحرّك أعضاءها (آلية parentId في React Flow: مواضع الأبناء نسبية لأبيهم).
 * 3. تغيير حجم المجموعة يعيد حساب العضوية: التوسيع يلتقط العقد التي صارت بداخلها، والتصغير يطلق ما خرج.
 * 4. حذف المجموعة لا يحذف أعضاءها: يُطلقون في أماكنهم على اللوحة (لا نفقد محتوى بسبب حذف إطار).
 * 5. لا تداخل بين المجموعات (لا مجموعة داخل مجموعة) في هذه النسخة؛ المجموعات لا تنضم لغيرها.
 * 6. المجموعات تأتي أولاً في مصفوفة العقد: React Flow يشترط أن يسبق الأب أبناءه، وتبقى المجموعة خلف العناصر.
 */

export interface Size {
  width: number
  height: number
}

/** الحجم الفعلي: القياس الذي أجراه React Flow إن وُجد، ثم الحجم المخزن، ثم الافتراضي حسب النوع. */
export function getNodeSize(node: CanvasNode): Size {
  const fallback = node.type === 'image' ? { width: 280, height: 200 } : NODE_SIZES[node.type]
  return {
    width: node.measured?.width ?? node.width ?? fallback.width,
    height: node.measured?.height ?? node.height ?? fallback.height,
  }
}

/** الموضع على اللوحة: موضع العقدة نسبي لأبيها (إن وُجد)، والمجموعات لا تتداخل فمستوى واحد يكفي. */
export function getAbsolutePosition(node: CanvasNode, byId: ReadonlyMap<string, CanvasNode>): XYPosition {
  if (!node.parentId) return node.position
  const parent = byId.get(node.parentId)
  if (!parent) return node.position
  return { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
}

/** نقل المجموعات إلى بداية المصفوفة مع حفظ الترتيب النسبي لكل فئة (ثبات الترتيب مهم لعدم تبديل طبقات الرسم). */
export function sortGroupsFirst(nodes: CanvasNode[]): CanvasNode[] {
  const groups: CanvasNode[] = []
  const others: CanvasNode[] = []
  for (const node of nodes) (isGroupNode(node) ? groups : others).push(node)
  const sorted = [...groups, ...others]
  // إن كان الترتيب سليماً أصلاً نعيد المصفوفة نفسها فلا يُعاد رسم شيء
  return sorted.every((node, index) => node === nodes[index]) ? nodes : sorted
}

/** أصغر مجموعة يقع المركز داخلها (الأصغر أدق عند تراكب مجموعتين). */
export function findContainingGroup(center: XYPosition, groups: readonly GroupContainer[]): GroupContainer | undefined {
  let best: GroupContainer | undefined
  let bestArea = Number.POSITIVE_INFINITY
  for (const group of groups) {
    const { width, height } = getNodeSize(group)
    const inside =
      center.x >= group.position.x &&
      center.x <= group.position.x + width &&
      center.y >= group.position.y &&
      center.y <= group.position.y + height
    if (inside && width * height < bestArea) {
      best = group
      bestArea = width * height
    }
  }
  return best
}

function withParent(node: CanvasNode, parent: GroupContainer, abs: XYPosition): CanvasNode {
  return { ...node, parentId: parent.id, position: { x: abs.x - parent.position.x, y: abs.y - parent.position.y } }
}

function withoutParent(node: CanvasNode, abs: XYPosition): CanvasNode {
  const { parentId, ...rest } = node
  void parentId // نتجاهل القيمة عمداً: الحذف الصريح للحقل أنظف من تعيينه undefined
  return { ...rest, position: abs } as CanvasNode
}

/** يعيد تقييم العضوية للعقد المحددة بمعرّفاتها. يعيد المصفوفة نفسها إن لم يتغير شيء. */
export function reconcileMembership(nodes: CanvasNode[], ids: ReadonlySet<string>): CanvasNode[] {
  const groups = nodes.filter(isGroupNode)
  const hasParented = nodes.some((node) => node.parentId !== undefined)
  if (groups.length === 0 && !hasParented) return nodes

  const byId = new Map(nodes.map((node) => [node.id, node]))
  let changed = false
  const next = nodes.map((node) => {
    if (isGroupNode(node) || !ids.has(node.id)) return node
    const abs = getAbsolutePosition(node, byId)
    const { width, height } = getNodeSize(node)
    const target = findContainingGroup({ x: abs.x + width / 2, y: abs.y + height / 2 }, groups)
    if (target?.id === node.parentId) return node
    changed = true
    return target ? withParent(node, target, abs) : withoutParent(node, abs)
  })
  return changed ? sortGroupsFirst(next) : nodes
}

/** يعيد تقييم عضوية كل العقد غير المجموعات (بعد تغيير حجم مجموعة). */
export function reconcileAllMembership(nodes: CanvasNode[]): CanvasNode[] {
  return reconcileMembership(nodes, new Set(nodes.filter((n) => !isGroupNode(n)).map((n) => n.id)))
}

/**
 * يُطلق أبناء المجموعات المحذوفة في أماكنهم المطلقة، إلا من سيُحذف معها أيضاً (ضمن keepOut).
 * يجب استدعاؤه قبل إزالة المجموعة، لأن موضع الأب مطلوب لتحويل الإحداثيات.
 */
export function releaseChildren(
  nodes: CanvasNode[],
  groupIds: ReadonlySet<string>,
  alsoRemoved: ReadonlySet<string> = new Set(),
): CanvasNode[] {
  if (groupIds.size === 0) return nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return nodes.map((node) => {
    if (!node.parentId || !groupIds.has(node.parentId) || alsoRemoved.has(node.id)) return node
    return withoutParent(node, getAbsolutePosition(node, byId))
  })
}
