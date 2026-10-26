/** ألوان السمة المتاحة للمساحة. القيم الفعلية (hex) في utils/constants.ts */
export const WORKSPACE_COLOR_IDS = ['lapis', 'saffron', 'moss', 'rose', 'violet', 'slate'] as const
export type WorkspaceColorId = (typeof WORKSPACE_COLOR_IDS)[number]

/** الأيقونات المتاحة للمساحة (مرتبطة بأيقونات Lucide في WorkspaceIcon.tsx). */
export const WORKSPACE_ICON_IDS = [
  'folder-kanban',
  'graduation-cap',
  'languages',
  'blocks',
  'lightbulb',
  'rocket',
  'book-open',
  'compass',
  'palette',
  'code',
  'network',
  'sparkles',
] as const
export type WorkspaceIconId = (typeof WORKSPACE_ICON_IDS)[number]

export type PreviewKind = 'sticky' | 'text' | 'image' | 'link' | 'group'

/**
 * مستطيل مصغّر في معاينة البطاقة. الإحداثيات مطبّعة بين 0 و 1 نسبةً لحدود المحتوى،
 * فتُرسم المعاينة بأي حجم دون الحاجة لقراءة بيانات اللوحة الكاملة.
 */
export interface PreviewRect {
  x: number
  y: number
  w: number
  h: number
  kind: PreviewKind
}

/** بيانات تعريف المساحة (ما تحتاجه لوحة التحكم فقط، دون العقد والروابط). */
export interface WorkspaceMeta {
  id: string
  name: string
  description: string
  color: WorkspaceColorId
  icon: WorkspaceIconId
  createdAt: number
  updatedAt: number
  /** null حتى تُفتح المساحة لأول مرة */
  lastOpenedAt: number | null
  nodeCount: number
  preview: PreviewRect[]
}

/** ما يختاره المستخدم عند إنشاء مساحة أو تعديلها. */
export interface WorkspaceInput {
  name: string
  description: string
  color: WorkspaceColorId
  icon: WorkspaceIconId
}

export type WorkspaceSortKey = 'modified' | 'created' | 'name'
