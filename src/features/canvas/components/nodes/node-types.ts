import type { NodeTypes } from '@xyflow/react'
import { GroupNode } from './GroupNode'
import { ImageCardNode } from './ImageCardNode'
import { LinkCardNode } from './LinkCardNode'
import { StickyNoteNode } from './StickyNoteNode'
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
  group: GroupNode,
} satisfies NodeTypes
