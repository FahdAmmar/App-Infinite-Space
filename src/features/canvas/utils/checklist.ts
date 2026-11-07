import type { ChecklistItem } from '../types/nodes'
import { CHECKLIST_LIMITS } from './constants'

/** عمليات قائمة المهام كدوال نقية: ترجع مصفوفة جديدة، أو المصفوفة نفسها إن لم يتغير شيء. */

export interface ChecklistProgress {
  total: number
  done: number
  /** 0 إلى 100، صحيح */
  percent: number
}

export function checklistProgress(items: readonly ChecklistItem[]): ChecklistProgress {
  const done = items.filter((item) => item.done).length
  return { total: items.length, done, percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100) }
}

/** يقصّ النص ويحدّ طوله؛ الفراغ يعني «لا عنصر». */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, CHECKLIST_LIMITS.itemMaxLength)
}

export function addChecklistItem(items: readonly ChecklistItem[], text: string, id: string): readonly ChecklistItem[] {
  const value = clean(text)
  if (value === '' || items.length >= CHECKLIST_LIMITS.maxItems || items.some((item) => item.id === id)) return items
  return [...items, { id, text: value, done: false }]
}

export function toggleChecklistItem(items: readonly ChecklistItem[], id: string): readonly ChecklistItem[] {
  if (!items.some((item) => item.id === id)) return items
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
}

/** تعديل نص عنصر؛ تفريغ النص يحذف العنصر (سلوك القوائم المألوف). */
export function renameChecklistItem(items: readonly ChecklistItem[], id: string, text: string): readonly ChecklistItem[] {
  const current = items.find((item) => item.id === id)
  if (!current) return items
  const value = clean(text)
  if (value === '') return items.filter((item) => item.id !== id)
  if (value === current.text) return items
  return items.map((item) => (item.id === id ? { ...item, text: value } : item))
}

export function removeChecklistItem(items: readonly ChecklistItem[], id: string): readonly ChecklistItem[] {
  return items.some((item) => item.id === id) ? items.filter((item) => item.id !== id) : items
}
