import type { Node } from '@xyflow/react'

/**
 * نموذج العقد على اللوحة.
 *
 * نبني فوق نوع Node الخاص بـ React Flow (الذي يوفّر id و type و position و width/height)،
 * ونضيف الخصائص المشتركة (createdAt/updatedAt/tags) داخل data.
 * كل نوع عقدة له data خاص به، ويجمعها اتحاد مميَّز (discriminated union) بحقل type،
 * فيضيّق TypeScript النوع تلقائياً داخل switch ويمنع خلط بيانات الأنواع.
 */

export const STICKY_COLOR_IDS = ['yellow', 'blue', 'green', 'pink', 'purple', 'neutral', 'orange', 'red'] as const
export type StickyColorId = (typeof STICKY_COLOR_IDS)[number]

/** حالة البطاقة (دائرة «تم» في زاويتها): none = بلا حالة، doing = قيد العمل، done = تم */
export const CARD_STATUSES = ['none', 'doing', 'done'] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

/** خصائص مشتركة بين كل أنواع العقد */
export type BaseNodeData = {
  createdAt: number
  updatedAt: number
  tags: string[]
  /** الغياب = none. لا تُخزَّن القيمة الافتراضية (تبقى اللوحات القديمة والجديدة متطابقة الشكل). المجموعات لا حالة لها. */
  status?: CardStatus
  /** الغياب = false. بطاقة مقفلة: لا تتحرك ولا يتغير حجمها ولا تُحذف حتى يُفكّ قفلها؛ محتواها يبقى قابلاً للتحرير. */
  locked?: boolean
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

/** مظهر بطاقة الصورة: card = إطار وترويسة وتذييل، frameless = الصورة وحدها («ملصق»)، cover = الصورة تملأ البطاقة والعنوان فوقها */
export const IMAGE_APPEARANCES = ['card', 'frameless', 'cover'] as const
export type ImageAppearance = (typeof IMAGE_APPEARANCES)[number]

export type ImageCardData = BaseNodeData & {
  /** مفتاح الصورة في IndexedDB. لا نخزّن بيانات الصورة نفسها داخل العقدة (تضخّم الحالة والتخزين). */
  imageId: string
  title: string
  description: string
  fileName: string
  /** الأبعاد الأصلية للصورة بالبكسل: تحدد نسبة العرض إلى الارتفاع فتبقى محفوظة عند تغيير الحجم */
  naturalWidth: number
  naturalHeight: number
  /** الغياب = card */
  appearance?: ImageAppearance
}

export type LinkCardData = BaseNodeData & {
  /** عنوان مُعقَّم (http/https فقط) أو سلسلة فارغة قبل أن يضيفه المستخدم */
  url: string
  title: string
  description: string
}

export type ChecklistItem = {
  /** معرّف محلي داخل البطاقة (للمفاتيح والتحرير)، لا يُستعمل خارجها */
  id: string
  text: string
  done: boolean
}

export type ChecklistData = BaseNodeData & {
  title: string
  items: ChecklistItem[]
}

/** أشكال Miro الأساسية: مستطيل، دائرة/إهليلج، معيّن */
export const SHAPE_KINDS = ['rectangle', 'ellipse', 'diamond'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]

export type ShapeData = BaseNodeData & {
  shape: ShapeKind
  /** نص داخل الشكل (اختياري) */
  label: string
  color: StickyColorId
}

export type VideoData = BaseNodeData & {
  /** رابط YouTube القياسي (https://www.youtube.com/watch?v=...) أو فارغ قبل أن يضيفه المستخدم. المشغّل يُبنى من معرّفه عند النقر فقط. */
  url: string
  title: string
}

export type GroupData = BaseNodeData & {
  label: string
  color: StickyColorId
}

export type StickyNote = Node<StickyNoteData, 'sticky'>
export type TextCard = Node<TextCardData, 'text'>
export type ImageCard = Node<ImageCardData, 'image'>
export type LinkCard = Node<LinkCardData, 'link'>
export type ChecklistCard = Node<ChecklistData, 'checklist'>
export type ShapeCard = Node<ShapeData, 'shape'>
export type VideoCard = Node<VideoData, 'video'>
export type GroupContainer = Node<GroupData, 'group'>

export type CanvasNode = StickyNote | TextCard | ImageCard | LinkCard | ChecklistCard | ShapeCard | VideoCard | GroupContainer
export type CanvasNodeType = CanvasNode['type']

/** الأنواع التي تُنشأ بالنقر على اللوحة (الصور تُنشأ من ملفات، فلها مسار مستقل) */
export type CreatableNodeKind = 'sticky' | 'text' | 'link' | 'checklist' | 'shape' | 'video' | 'group'

/** 'connect' أداة الوصل بالنقر على عقدتين (بديل للسحب من المقابض، ومناسب للمس) */
export type CanvasTool = 'select' | 'hand' | 'connect' | CreatableNodeKind

export function isGroupNode(node: CanvasNode): node is GroupContainer {
  return node.type === 'group'
}
