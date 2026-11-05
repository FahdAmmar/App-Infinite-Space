import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { findMatches, normalizeForSearch } from './find'
import { createGroup, createStickyNote, createTextCard } from './node-factory'

const sticky = (id: string, title: string, content: string, tags: string[], x = 0, y = 0): CanvasNode => {
  const base = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...base, id, position: { x, y }, data: { ...base.data, title, content, tags } } as CanvasNode
}

describe('normalizeForSearch', () => {
  it('ignores case, accents, and Arabic diacritics', () => {
    expect(normalizeForSearch('Café')).toBe('cafe')
    expect(normalizeForSearch('ÉCOLE')).toBe('ecole')
    expect(normalizeForSearch('مَرْحَبًا')).toBe('مرحبا')
  })
})

describe('findMatches', () => {
  const nodes = [
    sticky('late', 'Roadmap', 'ship the export feature', ['plan'], 0, 400),
    sticky('early', 'Ideas', 'Export to PDF', ['plan', 'later'], 300, 0),
    sticky('other', 'Groceries', 'milk', [], 0, 200),
  ]

  it('returns nothing for an empty or whitespace query', () => {
    expect(findMatches(nodes, '')).toEqual([])
    expect(findMatches(nodes, '   ')).toEqual([])
  })

  it('matches title and content, ignoring case, ordered top to bottom', () => {
    expect(findMatches(nodes, 'EXPORT')).toEqual(['early', 'late'])
  })

  it('requires every word (AND), in any order', () => {
    expect(findMatches(nodes, 'feature export')).toEqual(['late'])
    expect(findMatches(nodes, 'export milk')).toEqual([])
  })

  it('searches tags as plain text too', () => {
    expect(findMatches(nodes, 'later')).toEqual(['early'])
  })

  it('#tag searches tags only, by part of the tag', () => {
    expect(findMatches(nodes, '#plan')).toEqual(['early', 'late'])
    expect(findMatches(nodes, '#pla')).toEqual(['early', 'late'])
    expect(findMatches(nodes, '#milk')).toEqual([]) // موجودة في النص لا في الوسوم
    expect(findMatches(nodes, '#')).toEqual([])
  })

  it('breaks vertical ties from left to right', () => {
    const row = [sticky('right', 'x', 'hit', [], 500, 0), sticky('left', 'x', 'hit', [], 0, 0)]
    expect(findMatches(row, 'hit')).toEqual(['left', 'right'])
  })

  it('finds a group by its label and a text card by its content', () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' } as CanvasNode
    const labeled = { ...group, data: { ...group.data, label: 'Research phase' } } as CanvasNode
    const text = { ...createTextCard({ x: 0, y: 0 }, 1), id: 't' } as CanvasNode
    const filled = { ...text, data: { ...text.data, content: 'long form notes' } } as CanvasNode
    expect(findMatches([labeled, filled], 'research')).toEqual(['g'])
    expect(findMatches([labeled, filled], 'notes')).toEqual(['t'])
  })

  it('orders a card inside a group by its absolute position', () => {
    const frame = { ...createGroup({ x: 0, y: 0 }, 1), id: 'frame', position: { x: 0, y: 1000 } } as CanvasNode
    const inside = { ...sticky('inside', 'hit', '', [], 10, 10), parentId: 'frame' } as CanvasNode // مطلق y=1010
    const outside = sticky('outside', 'hit', '', [], 0, 500)
    expect(findMatches([frame, inside, outside], 'hit')).toEqual(['outside', 'inside'])
  })

  it('treats regular-expression characters as plain text', () => {
    const odd = [sticky('a', 'cost (usd) [draft]', '', [])]
    expect(findMatches(odd, '(usd) [draft]')).toEqual(['a'])
    expect(findMatches(odd, '.*')).toEqual([])
  })
})
