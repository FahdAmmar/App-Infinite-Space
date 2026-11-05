import type { CanvasNode } from '../types/nodes'

/** ما نُقر عليه بزر الفأرة الأيمن (أو بالضغط المطوّل على اللمس). */
export type MenuTarget = { kind: 'pane' } | { kind: 'node'; id: string } | { kind: 'edge'; id: string }

export type MenuActionId =
  | 'add-sticky'
  | 'add-text'
  | 'add-link'
  | 'add-group'
  | 'add-image'
  | 'paste'
  | 'select-all'
  | 'fit'
  | 'edit'
  | 'duplicate'
  | 'copy'
  | 'cut'
  | 'connect'
  | 'focus'
  | 'focus-clear'
  | 'front'
  | 'back'
  | 'copy-link'
  | 'delete'
  | 'edit-edge'
  | 'delete-edge'

export interface MenuItem {
  id: MenuActionId
  label: string
  /** اختصار لوحة المفاتيح للتذكير فقط */
  hint?: string
  danger?: boolean
  disabled?: boolean
}

export type MenuEntry = MenuItem | 'separator'

export interface MenuContext {
  nodes: readonly CanvasNode[]
  selectedIds: readonly string[]
  /** هل في حافظة التطبيق بطاقات للصق؟ */
  hasClipboard: boolean
  focusId: string | null
}

/**
 * البطاقات التي ينطبق عليها الأمر: التحديد كله إن كانت البطاقة المنقورة جزءاً منه (كأي تطبيق رسم)،
 * وإلا البطاقة وحدها.
 */
export function menuSubjects(target: string, selectedIds: readonly string[]): string[] {
  return selectedIds.includes(target) ? [...selectedIds] : [target]
}

/** يحذف الفواصل المتتالية أو الزائدة في أول القائمة وآخرها (حين تُحذف عناصر شرطية). */
function tidy(entries: readonly (MenuEntry | false)[]): MenuEntry[] {
  const out: MenuEntry[] = []
  for (const entry of entries) {
    if (entry === false) continue
    if (entry === 'separator' && (out.length === 0 || out[out.length - 1] === 'separator')) continue
    out.push(entry)
  }
  if (out[out.length - 1] === 'separator') out.pop()
  return out
}

/** بنية القائمة المناسبة لما نُقر عليه. دالة نقية: لا تلمس المخزن، فتُختبر بلا واجهة. */
export function buildContextMenu(target: MenuTarget, context: MenuContext): MenuEntry[] {
  if (target.kind === 'edge') {
    return [
      { id: 'edit-edge', label: 'Edit connection…' },
      'separator',
      { id: 'delete-edge', label: 'Delete connection', hint: 'Del', danger: true },
    ]
  }

  if (target.kind === 'pane') {
    return [
      { id: 'add-sticky', label: 'Add sticky note here', hint: 'N' },
      { id: 'add-text', label: 'Add text card here', hint: 'T' },
      { id: 'add-link', label: 'Add link card here', hint: 'L' },
      { id: 'add-group', label: 'Add group here', hint: 'G' },
      { id: 'add-image', label: 'Add image…', hint: 'I' },
      'separator',
      { id: 'paste', label: 'Paste', hint: 'Ctrl/⌘ V', disabled: !context.hasClipboard },
      { id: 'select-all', label: 'Select all', hint: 'Ctrl/⌘ A', disabled: context.nodes.length === 0 },
      { id: 'fit', label: 'Fit all content', hint: '⇧ 1', disabled: context.nodes.length === 0 },
    ]
  }

  const subjects = menuSubjects(target.id, context.selectedIds)
  const only = subjects.length === 1 ? context.nodes.find((node) => node.id === subjects[0]) : undefined
  const isCard = only !== undefined && only.type !== 'group'
  const focused = isCard && context.focusId === only.id

  return tidy([
    only !== undefined && only.type !== 'image' && { id: 'edit', label: 'Edit text', hint: 'F2' },
    { id: 'duplicate', label: 'Duplicate', hint: 'Ctrl/⌘ D' },
    { id: 'copy', label: 'Copy', hint: 'Ctrl/⌘ C' },
    { id: 'cut', label: 'Cut', hint: 'Ctrl/⌘ X' },
    'separator',
    isCard && { id: 'connect', label: 'Connect to…', hint: 'C' },
    isCard && (focused ? { id: 'focus-clear', label: 'Clear focus', hint: 'F' } : { id: 'focus', label: 'Focus on this branch', hint: 'F' }),
    { id: 'front', label: 'Bring to front', hint: ']' },
    { id: 'back', label: 'Send to back', hint: '[' },
    isCard && { id: 'copy-link', label: 'Copy link to card' },
    'separator',
    { id: 'delete', label: subjects.length > 1 ? `Delete ${subjects.length} items` : 'Delete', hint: 'Del', danger: true },
  ])
}

/** إحداثيات القائمة بعد إبقائها داخل النافذة (تنقلب عن حافتي اليمين والأسفل بدل أن تُقصّ). */
export function clampMenuPosition(
  point: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { x: number; y: number } {
  const x = point.x + size.width + margin > viewport.width ? point.x - size.width : point.x
  const y = point.y + size.height + margin > viewport.height ? point.y - size.height : point.y
  return {
    x: Math.max(margin, Math.min(x, viewport.width - size.width - margin)),
    y: Math.max(margin, Math.min(y, viewport.height - size.height - margin)),
  }
}

/** مقاسات الصفوف ثابتة في CSS (h-9 وفاصل 9px وحشوة 12px)، فيُحسب حجم القائمة بلا قياس DOM ولا تأثير جانبي. */
export const MENU_ROW_HEIGHT = 36
export const MENU_SEPARATOR_HEIGHT = 9
export const MENU_PADDING = 12
export const MENU_WIDTH = 232

export function menuSize(entries: readonly MenuEntry[]): { width: number; height: number } {
  const separators = entries.filter((entry) => entry === 'separator').length
  const rows = entries.length - separators
  return { width: MENU_WIDTH, height: MENU_PADDING + rows * MENU_ROW_HEIGHT + separators * MENU_SEPARATOR_HEIGHT }
}
