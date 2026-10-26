import type {
  WorkspaceColorId,
  WorkspaceIconId,
  WorkspaceSortKey,
} from '../types/workspace'

export const NAME_MAX_LENGTH = 60
export const DESCRIPTION_MAX_LENGTH = 200
/** حد أقصى لعدد المستطيلات المخزّنة للمعاينة حتى لا تتضخم بيانات التعريف. */
export const PREVIEW_MAX_RECTS = 40

export const DEFAULT_COLOR: WorkspaceColorId = 'lapis'
export const DEFAULT_ICON: WorkspaceIconId = 'sparkles'

/** لون واحد يعمل على الخلفيتين الداكنة والفاتحة؛ التباين يُضبط عبر color-mix في CSS. */
export const WORKSPACE_COLORS: Record<WorkspaceColorId, { label: string; hex: string }> = {
  lapis: { label: 'Lapis', hex: '#7C9CFF' },
  saffron: { label: 'Saffron', hex: '#E8B65A' },
  moss: { label: 'Moss', hex: '#5BC49A' },
  rose: { label: 'Rose', hex: '#EE8DB4' },
  violet: { label: 'Violet', hex: '#A78BFA' },
  slate: { label: 'Slate', hex: '#9AA3AF' },
}

export const WORKSPACE_ICON_LABELS: Record<WorkspaceIconId, string> = {
  'folder-kanban': 'Projects',
  'graduation-cap': 'Learning',
  languages: 'Languages',
  blocks: 'Building blocks',
  lightbulb: 'Ideas',
  rocket: 'Launch',
  'book-open': 'Reading',
  compass: 'Exploration',
  palette: 'Creative',
  code: 'Code',
  network: 'Architecture',
  sparkles: 'General',
}

export const SORT_OPTIONS: ReadonlyArray<{ value: WorkspaceSortKey; label: string }> = [
  { value: 'modified', label: 'Last modified' },
  { value: 'created', label: 'Date created' },
  { value: 'name', label: 'Name (A–Z)' },
]

/**
 * مساحة الرسم داخل إطار معاينة البطاقة (بوحدات viewBox 100×60 بعد الهوامش).
 * يستعملها رسم المعاينة وحساب المستطيلات المطبّعة معاً كي يبقى تناسب المحتوى صحيحاً.
 */
export const PREVIEW_AREA = { width: 88, height: 48 } as const
