import { describe, expect, it } from 'vitest'
import type { WorkspaceMeta } from '../types/workspace'
import { filterWorkspaces, normalizeForSearch, selectRecentWorkspaces, sortWorkspaces } from './query'

function ws(partial: Partial<WorkspaceMeta> & { id: string; name: string }): WorkspaceMeta {
  return {
    description: '',
    color: 'lapis',
    icon: 'sparkles',
    createdAt: 0,
    updatedAt: 0,
    lastOpenedAt: null,
    nodeCount: 0,
    preview: [],
    ...partial,
  }
}

const list = [
  ws({ id: 'a', name: 'My Projects', description: 'Side work', createdAt: 1, updatedAt: 30 }),
  ws({ id: 'b', name: 'German Learning', description: 'Vokabeln und Grammatik', createdAt: 3, updatedAt: 10 }),
  ws({ id: 'c', name: 'Café Ideas', createdAt: 2, updatedAt: 20 }),
]

describe('normalizeForSearch', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeForSearch('Café')).toBe('cafe')
  })

  it('strips Arabic diacritics (tashkeel)', () => {
    expect(normalizeForSearch('الأَلمانِيّة')).toBe(normalizeForSearch('الألمانية'))
  })
})

describe('filterWorkspaces', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterWorkspaces(list, '')).toHaveLength(3)
    expect(filterWorkspaces(list, '   ')).toHaveLength(3)
  })

  it('matches name and description, case- and accent-insensitively', () => {
    expect(filterWorkspaces(list, 'cafe').map((w) => w.id)).toEqual(['c'])
    expect(filterWorkspaces(list, 'GRAMMATIK').map((w) => w.id)).toEqual(['b'])
  })

  it('requires every term to match (AND)', () => {
    expect(filterWorkspaces(list, 'german grammatik').map((w) => w.id)).toEqual(['b'])
    expect(filterWorkspaces(list, 'german projects')).toEqual([])
  })
})

describe('sortWorkspaces', () => {
  it('sorts by last modified (newest first)', () => {
    expect(sortWorkspaces(list, 'modified').map((w) => w.id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts by creation date (newest first)', () => {
    expect(sortWorkspaces(list, 'created').map((w) => w.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by name using natural, accent-insensitive order', () => {
    const named = [ws({ id: '1', name: 'Space 10' }), ws({ id: '2', name: 'Space 2' }), ws({ id: '3', name: 'Zebra' })]
    expect(sortWorkspaces(named, 'name').map((w) => w.name)).toEqual(['Space 2', 'Space 10', 'Zebra'])
  })

  it('does not mutate the input array', () => {
    const copy = [...list]
    sortWorkspaces(list, 'name')
    expect(list).toEqual(copy)
  })
})

describe('selectRecentWorkspaces', () => {
  it('only includes opened workspaces, most recently opened first, up to the limit', () => {
    const items = [
      ws({ id: 'x', name: 'X', lastOpenedAt: 5 }),
      ws({ id: 'y', name: 'Y', lastOpenedAt: 9 }),
      ws({ id: 'z', name: 'Z', lastOpenedAt: null }),
      ws({ id: 'w', name: 'W', lastOpenedAt: 7 }),
    ]
    expect(selectRecentWorkspaces(items, 2).map((w) => w.id)).toEqual(['y', 'w'])
  })
})
