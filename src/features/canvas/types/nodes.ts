import type { Node } from '@xyflow/react'

/**
 * نموذج العقد على اللوحة.
 *
 * نبني فوق نوع Node الخاص بـ React Flow (الذي يوفّر id و type و position و width/height)،
 * ونضيف الخصائص المشتركة (createdAt/updatedAt/tags) داخل data.
 * كل نوع عقدة له data خاص به، ويجمعها اتحاد مميَّز (discriminated union) بحقل type،
 * فيضيّق TypeScript النوع تلقائياً داخل switch ويمنع خلط بيانات الأنواع.
 */

export const STICKY_COLOR_IDS = ['yellow', 'blue', 'green', 'pink', 'purple', 'neutral'] as const
export type StickyColorId = (typeof STICKY_COLOR_IDS)[number]

/** خصائص مشتركة بين كل أنواع العقد */
export type BaseNodeData = {
  createdAt: number
  updatedAt: number
  tags: string[]
}

export type StickyNoteData = BaseNodeData & {
  title: string
  content: string
  color: StickyColorId
  /** null = اللون الافتراضي للورقة؛ يُعرض إن حُدّد لون مخصص */
  textColor: string | null
}

export type TextCardData = BaseNodeData & {
  title: string
  content: string
}

export type ImageCardData = BaseNodeData & {
  /** مفتاح الصورة في IndexedDB. لا نخزّن بيانات الصورة نفسها داخل العقدة (تضخّم الحالة والتخزين). */
  imageId: string
  title: string
  description: string
  fileName: string
  /** الأبعاد الأصلية للصورة بالبكسل: تحدد نسبة العرض إلى الارتفاع فتبقى محفوظة عند تغيير الحجم */
  naturalWidth: number
  naturalHeight: number
}

export type LinkCardData = BaseNodeData & {
  /** عنوان مُعقَّم (http/https فقط) أو سلسلة فارغة قبل أن يضيفه المستخدم */
  url: string
  title: string
  description: string
}

export type GroupData = BaseNodeData & {
  label: string
  color: StickyColorId
}

export type StickyNote = Node<StickyNoteData, 'sticky'>
export type TextCard = Node<TextCardData, 'text'>
export type ImageCard = Node<ImageCardData, 'image'>
export type LinkCard = Node<LinkCardData, 'link'>
export type GroupContainer = Node<GroupData, 'group'>

export type CanvasNode = StickyNote | TextCard | ImageCard | LinkCard | GroupContainer
export type CanvasNodeType = CanvasNode['type']

/** الأنواع التي تُنشأ بالنقر على اللوحة (الصور تُنشأ من ملفات، فلها مسار مستقل) */
export type CreatableNodeKind = 'sticky' | 'text' | 'link' | 'group'

/** 'connect' أداة الوصل بالنقر على عقدتين (بديل للسحب من المقابض، ومناسب للمس) */
export type CanvasTool = 'select' | 'hand' | 'connect' | CreatableNodeKind

export function isGroupNode(node: CanvasNode): node is GroupContainer {
  return node.type === 'group'
}
