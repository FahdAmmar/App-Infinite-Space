import type { CanvasNode } from '../types/nodes'
import { getNodeSize } from './group-utils'

export interface SlideRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * ترتيب العرض: المجموعات فقط بترتيب القراءة (صفوف من الأعلى إلى الأسفل، وداخل الصف من اليسار إلى اليمين).
 * مجموعتان تُعدّان في صف واحد إن كان فرق أعلاهما أقل من نصف ارتفاع أول مجموعة في الصف: بهذا لا يقلب
 * ارتفاع أو انزياح بسيط بين مجموعتين متجاورتين ترتيب الشرائح.
 */
export function orderSlides(nodes: readonly CanvasNode[]): CanvasNode[] {
  const groups = nodes.filter((node) => node.type === 'group')
  groups.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  const rows: CanvasNode[][] = []
  for (const group of groups) {
    const row = rows[rows.length - 1]
    const first = row?.[0]
    if (row && first && group.position.y - first.position.y < getNodeSize(first).height / 2) row.push(group)
    else rows.push([group])
  }
  return rows.flatMap((row) => row.sort((a, b) => a.position.x - b.position.x))
}

/** إطار الشريحة على اللوحة (المجموعات لا تتداخل ولا تتداخل، فموضعها مطلق). */
export function slideRect(group: CanvasNode): SlideRect {
  const { width, height } = getNodeSize(group)
  return { x: group.position.x, y: group.position.y, width, height }
}

/** عنوان الشريحة: اسم المجموعة، أو «Slide N» إن كان فارغاً. */
export function slideTitle(group: CanvasNode, index: number): string {
  const label = group.type === 'group' ? group.data.label.trim() : ''
  return label === '' ? `Slide ${index + 1}` : label
}

export type SlideStep = 1 | -1 | 'first' | 'last'

/** الشريحة التالية دون التفاف (آخر شريحة تبقى آخر شريحة): عرض يعود فجأة للأول يربك الجمهور. */
export function stepSlide(index: number, count: number, step: SlideStep): number {
  if (count <= 0) return 0
  if (step === 'first') return 0
  if (step === 'last') return count - 1
  return Math.min(count - 1, Math.max(0, index + step))
}
