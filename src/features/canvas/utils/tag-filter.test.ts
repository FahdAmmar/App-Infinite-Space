import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { createEdge } from './edge-utils'
import { createGroup, createStickyNote } from './node-factory'
import { collectTags, countCards, dimEdges, dimNodes, DIMMED_CLASS, isDimmed, nodeMatchesTag } from './tag-filter'

const note = (id: string, tags: string[]): CanvasNode => {
  const sticky = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...sticky, id, data: { ...sticky.data, tags } }
}
const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }

describe('nodeMatchesTag / isDimmed', () => {
  it('matches regardless of letter case', () => {
    expect(nodeMatchesTag(note('a', ['Design']), 'design')).toBe(true)
    expect(nodeMatchesTag(note('a', ['design']), 'DESIGN')).toBe(true)
    expect(nodeMatchesTag(note('a', ['design']), 'des')).toBe(false)
  })

  it('works with Arabic tags', () => {
    expect(nodeMatchesTag(note('a', ['أفكار']), 'أفكار')).toBe(true)
  })

  it('dims cards without the tag but never groups', () => {
    expect(isDimmed(note('a', ['x']), 'y')).toBe(true)
    expect(isDimmed(note('a', ['y']), 'y')).toBe(false)
    expect(isDimmed(group, 'y')).toBe(false)
  })
})

describe('countCards', () => {
  it('counts matching and total cards, ignoring groups', () => {
    const nodes = [note('a', ['x']), note('b', []), note('c', ['X']), group]
    expect(countCards(nodes, 'x')).toEqual({ matching: 2, total: 3 })
  })
})

describe('collectTags', () => {
  it('merges tags that differ only by case and counts cards, most used first', () => {
    const nodes = [note('a', ['Design', 'ux']), note('b', ['design']), note('c', ['ux', 'ux']), note('d', ['zeta'])]
    expect(collectTags(nodes)).toEqual([
      { tag: 'Design', count: 2 },
      { tag: 'ux', count: 2 },
      { tag: 'zeta', count: 1 },
    ])
  })

  it('returns nothing for a canvas without tags', () => {
    expect(collectTags([note('a', [])])).toEqual([])
  })
})

describe('dimNodes', () => {
  const nodes = [note('a', ['x']), note('b', ['y']), group]

  it('marks only the cards without the tag, keeping matching cards and groups as the same objects', () => {
    const shown = dimNodes(nodes, 'x')
    expect(shown[0]).toBe(nodes[0])
    expect(shown[2]).toBe(nodes[2])
    expect(shown[1]?.className).toBe(DIMMED_CLASS)
    expect(shown[1]?.id).toBe('b')
  })

  it('returns the same dimmed object for an unchanged card, so React Flow can skip re-rendering it', () => {
    expect(dimNodes(nodes, 'x')[1]).toBe(dimNodes(nodes, 'x')[1])
  })

  it('does not change the stored cards', () => {
    dimNodes(nodes, 'x')
    expect(nodes[1]?.className).toBeUndefined()
  })
})

describe('dimEdges', () => {
  const nodes = [note('a', ['x']), note('b', ['x']), note('c', ['y'])]
  const ab: CanvasEdge = { ...createEdge('a', 'b', 'right', 'left'), id: 'ab' }
  const ac: CanvasEdge = { ...createEdge('a', 'c', 'right', 'left'), id: 'ac' }

  it('keeps a connection between two matching cards and dims one that reaches a dimmed card', () => {
    const shown = dimEdges([ab, ac], nodes, 'x')
    expect(shown[0]).toBe(ab)
    expect(shown[1]?.className).toBe(DIMMED_CLASS)
  })
})
