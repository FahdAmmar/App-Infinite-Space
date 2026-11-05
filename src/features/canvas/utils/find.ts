import type { CanvasNode } from '../types/nodes'
import { getAbsolutePosition } from './group-utils'

/**
 * البحث في محتوى البطاقات. المطابقة بلا حساسية لحالة الأحرف ولا للتشكيل (الحركات والعلامات فوق الحروف):
 * «cafe» تجد «café»، والبحث بكلمة عربية يجد النص المشكَّل. يحدث ذلك بتطبيع الطرفين بالطريقة نفسها.
 */

/** تطبيع للمقارنة فقط (لا يُعرض): تفكيك الحروف المركّبة، حذف علاماتها، ثم أحرف صغيرة. */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

function textFields(node: CanvasNode): string[] {
  switch (node.type) {
    case 'sticky':
    case 'text':
      return [node.data.title, node.data.content]
    case 'image':
      return [node.data.title, node.data.description, node.data.fileName]
    case 'link':
      return [node.data.title, node.data.description, node.data.url]
    case 'group':
      return [node.data.label]
  }
}

/**
 * معرّفات البطاقات المطابقة مرتبة من أعلى اللوحة إلى أسفلها (ثم من اليسار)، فيمشي المستخدم عليها بترتيب مقروء.
 *  - «#وسم» يطابق الوسوم فقط (جزء من الوسم يكفي).
 *  - غير ذلك: كل كلمة في الاستعلام يجب أن توجد في نص البطاقة أو وسومها (AND).
 */
export function findMatches(nodes: readonly CanvasNode[], query: string): string[] {
  const trimmed = query.trim()
  if (trimmed === '') return []

  const tagMode = trimmed.startsWith('#')
  const needle = normalizeForSearch(tagMode ? trimmed.slice(1).trim() : trimmed)
  if (needle === '') return []
  const terms = needle.split(/\s+/)

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const hits: Array<{ id: string; x: number; y: number }> = []
  for (const node of nodes) {
    const tags = node.data.tags.map(normalizeForSearch)
    const matched = tagMode
      ? tags.some((tag) => tag.includes(needle))
      : (() => {
          const haystack = normalizeForSearch([...textFields(node), ...node.data.tags].join('\n'))
          return terms.every((term) => haystack.includes(term))
        })()
    if (matched) {
      const { x, y } = getAbsolutePosition(node, byId)
      hits.push({ id: node.id, x, y })
    }
  }
  return hits.sort((a, b) => a.y - b.y || a.x - b.x).map((hit) => hit.id)
}
