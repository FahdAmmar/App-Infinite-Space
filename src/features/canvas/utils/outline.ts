import type { CanvasNode } from '../types/nodes'
import { getAbsolutePosition } from './group-utils'

/** صف في قائمة «المخطط»: مجموعة (عمق 0) أو بطاقة داخلها (عمق 1) أو بطاقة حرة (عمق 0). */
export interface OutlineEntry {
  id: string
  kind: CanvasNode['type']
  label: string
  depth: 0 | 1
  /** عدد البطاقات داخل المجموعة (0 لغيرها) */
  childCount: number
}

const LABEL_MAX = 80

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim() !== '')?.trim() ?? ''
}

function shorten(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** اسم مقروء للبطاقة في القوائم (العنوان، وإلا أول سطر من المحتوى، وإلا اسم للنوع). */
export function nodeLabel(node: CanvasNode): string {
  switch (node.type) {
    case 'sticky':
      return shorten(node.data.title.trim() || firstLine(node.data.content) || 'Empty note')
    case 'text':
      return shorten(node.data.title.trim() || firstLine(node.data.content) || 'Empty text card')
    case 'image':
      return shorten(node.data.title.trim() || node.data.fileName || 'Image')
    case 'link':
      return shorten(node.data.title.trim() || (node.data.url === '' ? 'Empty link' : hostOf(node.data.url)))
    case 'video':
      return shorten(node.data.title.trim() || (node.data.url === '' ? 'Empty video' : 'Video'))
    case 'shape':
      return shorten(node.data.label.trim() || 'Shape')
    case 'checklist':
      return shorten(node.data.title.trim() || node.data.items[0]?.text || 'Empty checklist')
    case 'group':
      return shorten(node.data.label.trim() || 'Untitled group')
  }
}

/**
 * قائمة خطية بترتيب القراءة (من أعلى اللوحة ثم اليسار): كل مجموعة تتبعها بطاقاتها، ثم البطاقات الحرة.
 * بديل مكاني للوحة يصلح لقارئ الشاشة وللهاتف ولوحة كبيرة يصعب التنقل فيها بصرياً.
 */
export function buildOutline(nodes: readonly CanvasNode[]): OutlineEntry[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const position = (node: CanvasNode) => getAbsolutePosition(node, byId)
  const reading = (a: CanvasNode, b: CanvasNode) => {
    const pa = position(a)
    const pb = position(b)
    return pa.y - pb.y || pa.x - pb.x
  }

  const groups = nodes.filter((node) => node.type === 'group').sort(reading)
  const groupIds = new Set(groups.map((group) => group.id))
  const entries: OutlineEntry[] = []

  for (const group of groups) {
    const members = nodes.filter((node) => node.parentId === group.id && node.type !== 'group').sort(reading)
    entries.push({ id: group.id, kind: 'group', label: nodeLabel(group), depth: 0, childCount: members.length })
    for (const member of members) entries.push({ id: member.id, kind: member.type, label: nodeLabel(member), depth: 1, childCount: 0 })
  }
  const free = nodes.filter((node) => node.type !== 'group' && (node.parentId === undefined || !groupIds.has(node.parentId))).sort(reading)
  for (const node of free) entries.push({ id: node.id, kind: node.type, label: nodeLabel(node), depth: 0, childCount: 0 })
  return entries
}
