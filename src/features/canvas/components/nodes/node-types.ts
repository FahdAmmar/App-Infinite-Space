import type { NodeTypes } from '@xyflow/react'
import { ChecklistNode } from './ChecklistNode'
import { GroupNode } from './GroupNode'
import { ImageCardNode } from './ImageCardNode'
import { LinkCardNode } from './LinkCardNode'
import { ShapeNode } from './ShapeNode'
import { StickyNoteNode } from './StickyNoteNode'
import { VideoNode } from './VideoNode'
import { TextCardNode } from './TextCardNode'

/**
 * سجل أنواع العقد: يربط حقل type بمكوّن العرض.
 * يجب أن يكون كائناً ثابتاً على مستوى الوحدة (لا يُنشأ داخل مكوّن)، وإلا يعيد React Flow
 * إنشاء كل العقد عند كل رسم. إضافة نوع جديد = سطر هنا + نوعه في types/nodes.ts.
 */
export const nodeTypes = {
  sticky: StickyNoteNode,
  text: TextCardNode,
  image: ImageCardNode,
  link: LinkCardNode,
  checklist: ChecklistNode,
  shape: ShapeNode,
  video: VideoNode,
  group: GroupNode,
} satisfies NodeTypes
