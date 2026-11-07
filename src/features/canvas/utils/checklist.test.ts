import { describe, expect, it } from 'vitest'
import type { ChecklistItem } from '../types/nodes'
import {
  addChecklistItem,
  checklistProgress,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from './checklist'
import { CHECKLIST_LIMITS } from './constants'

const item = (id: string, text = id, done = false): ChecklistItem => ({ id, text, done })

describe('checklistProgress', () => {
  it('counts done items and rounds the percentage', () => {
    expect(checklistProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
    expect(checklistProgress([item('a', 'a', true), item('b'), item('c')])).toEqual({ total: 3, done: 1, percent: 33 })
    expect(checklistProgress([item('a', 'a', true)]).percent).toBe(100)
  })
})

describe('addChecklistItem', () => {
  it('adds a trimmed, single-spaced item as not done', () => {
    expect(addChecklistItem([], '  buy   milk ', 'x')).toEqual([{ id: 'x', text: 'buy milk', done: false }])
  })

  it('ignores empty input, duplicate ids and a full list (same reference back)', () => {
    const items = [item('a')]
    expect(addChecklistItem(items, '   ', 'n')).toBe(items)
    expect(addChecklistItem(items, 'x', 'a')).toBe(items)
    const full = Array.from({ length: CHECKLIST_LIMITS.maxItems }, (_, i) => item(`i${i}`))
    expect(addChecklistItem(full, 'one more', 'z')).toBe(full)
  })

  it('cuts overly long text to the limit', () => {
    const [added] = addChecklistItem([], 'x'.repeat(1000), 'a')
    expect(added?.text).toHaveLength(CHECKLIST_LIMITS.itemMaxLength)
  })
})

describe('toggle, rename, remove', () => {
  it('toggles only the matching item', () => {
    const items = [item('a'), item('b')]
    expect(toggleChecklistItem(items, 'b').map((i) => i.done)).toEqual([false, true])
    expect(toggleChecklistItem(items, 'missing')).toBe(items)
  })

  it('renames, removes on empty text, and keeps the same reference when nothing changes', () => {
    const items = [item('a', 'old'), item('b')]
    expect(renameChecklistItem(items, 'a', ' new ')[0]?.text).toBe('new')
    expect(renameChecklistItem(items, 'a', '   ').map((i) => i.id)).toEqual(['b'])
    expect(renameChecklistItem(items, 'a', 'old')).toBe(items)
    expect(renameChecklistItem(items, 'zzz', 'x')).toBe(items)
  })

  it('removes an item or returns the same list when it is absent', () => {
    const items = [item('a'), item('b')]
    expect(removeChecklistItem(items, 'a').map((i) => i.id)).toEqual(['b'])
    expect(removeChecklistItem(items, 'q')).toBe(items)
  })
})
