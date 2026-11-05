import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { buildContextMenu, clampMenuPosition, MENU_WIDTH, menuSize, menuSubjects, type MenuContext, type MenuEntry } from './context-menu'
import { createGroup, createStickyNote } from './node-factory'

const sticky = (id: string): CanvasNode => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id })
const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
const base: MenuContext = { nodes: [sticky('a'), sticky('b'), group], selectedIds: [], hasClipboard: false, focusId: null }
const ids = (entries: readonly MenuEntry[]) => entries.map((entry) => (entry === 'separator' ? '-' : entry.id))

describe('menuSubjects', () => {
  it('uses the whole selection when the clicked card is part of it', () => {
    expect(menuSubjects('a', ['a', 'b'])).toEqual(['a', 'b'])
  })
  it('uses only the clicked card otherwise', () => {
    expect(menuSubjects('c', ['a', 'b'])).toEqual(['c'])
  })
})

describe('buildContextMenu: empty canvas', () => {
  it('offers creation, and disables paste and select all that cannot work', () => {
    const entries = buildContextMenu({ kind: 'pane' }, { ...base, nodes: [] })
    expect(ids(entries)).toEqual(['add-sticky', 'add-text', 'add-link', 'add-group', 'add-image', '-', 'paste', 'select-all', 'fit'])
    const disabled = entries.filter((entry) => entry !== 'separator' && entry.disabled).map((entry) => (entry as { id: string }).id)
    expect(disabled).toEqual(['paste', 'select-all', 'fit'])
  })

  it('enables paste only when the app clipboard holds cards', () => {
    const entries = buildContextMenu({ kind: 'pane' }, { ...base, hasClipboard: true })
    expect(entries.find((entry) => entry !== 'separator' && entry.id === 'paste')).toMatchObject({ disabled: false })
  })
})

describe('buildContextMenu: a card', () => {
  it('offers the full card menu for one sticky note', () => {
    const entries = buildContextMenu({ kind: 'node', id: 'a' }, { ...base, selectedIds: ['a'] })
    expect(ids(entries)).toEqual(['edit', 'duplicate', 'copy', 'cut', '-', 'connect', 'focus', 'front', 'back', 'copy-link', '-', 'delete'])
  })

  it('offers "clear focus" for the card that is already focused', () => {
    const entries = buildContextMenu({ kind: 'node', id: 'a' }, { ...base, selectedIds: ['a'], focusId: 'a' })
    expect(ids(entries)).toContain('focus-clear')
    expect(ids(entries)).not.toContain('focus')
  })

  it('leaves out connect, focus and link for a group', () => {
    const entries = buildContextMenu({ kind: 'node', id: 'g' }, { ...base, selectedIds: ['g'] })
    expect(ids(entries)).toEqual(['edit', 'duplicate', 'copy', 'cut', '-', 'front', 'back', '-', 'delete'])
  })

  it('treats a card outside the selection as the only subject', () => {
    const entries = buildContextMenu({ kind: 'node', id: 'b' }, { ...base, selectedIds: ['a', 'g'] })
    expect(ids(entries)).toContain('connect')
  })

  it('switches to selection-wide actions for several cards, with a count on delete', () => {
    const entries = buildContextMenu({ kind: 'node', id: 'a' }, { ...base, selectedIds: ['a', 'b'] })
    expect(ids(entries)).toEqual(['duplicate', 'copy', 'cut', '-', 'front', 'back', '-', 'delete'])
    expect(entries.at(-1)).toMatchObject({ id: 'delete', label: 'Delete 2 items', danger: true })
  })

  it('never starts or ends with a separator and never repeats one', () => {
    for (const selectedIds of [[], ['a'], ['a', 'b'], ['g']]) {
      const entries = buildContextMenu({ kind: 'node', id: selectedIds[0] ?? 'a' }, { ...base, selectedIds })
      expect(entries[0]).not.toBe('separator')
      expect(entries.at(-1)).not.toBe('separator')
      entries.forEach((entry, index) => {
        if (entry === 'separator') expect(entries[index - 1]).not.toBe('separator')
      })
    }
  })
})

describe('buildContextMenu: a connection', () => {
  it('offers edit and delete', () => {
    expect(ids(buildContextMenu({ kind: 'edge', id: 'e1' }, base))).toEqual(['edit-edge', '-', 'delete-edge'])
  })
})

describe('clampMenuPosition', () => {
  const size = { width: 200, height: 300 }
  const viewport = { width: 1000, height: 800 }

  it('keeps the click point when the menu fits', () => {
    expect(clampMenuPosition({ x: 100, y: 100 }, size, viewport)).toEqual({ x: 100, y: 100 })
  })
  it('flips to the left and upward near the right and bottom edges', () => {
    expect(clampMenuPosition({ x: 950, y: 750 }, size, viewport)).toEqual({ x: 750, y: 450 })
  })
  it('never leaves the window, even when the menu is larger than it', () => {
    expect(clampMenuPosition({ x: 5, y: 5 }, { width: 2000, height: 2000 }, viewport)).toEqual({ x: 8, y: 8 })
  })
})

describe('menuSize', () => {
  it('adds fixed row, separator and padding heights', () => {
    const entries = buildContextMenu({ kind: 'edge', id: 'e' }, base) // 2 rows and 1 separator
    expect(menuSize(entries)).toEqual({ width: MENU_WIDTH, height: 12 + 2 * 36 + 9 })
  })
})
