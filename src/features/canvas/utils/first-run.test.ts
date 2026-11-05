import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { createEdge } from './edge-utils'
import { CHECKLIST_MAX_NODES, checklistKey, stepsFromKey } from './first-run'
import { createGroup, createStickyNote } from './node-factory'

const sticky = (id: string, tags: string[] = []): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, data: { ...node.data, tags } }
}
const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
const edge: CanvasEdge = createEdge('a', 'b', 'right', 'left')

describe('checklistKey', () => {
  it('starts with nothing done on an empty canvas', () => {
    expect(checklistKey([], [])).toBe('0000')
  })

  it('ticks each step on its own', () => {
    expect(checklistKey([sticky('a')], [])).toBe('1000')
    expect(checklistKey([sticky('a'), sticky('b')], [edge])).toBe('1100')
    expect(checklistKey([sticky('a', ['x'])], [])).toBe('1010')
    expect(checklistKey([group], [])).toBe('0001')
  })

  it('does not count a group as a card', () => {
    expect(stepsFromKey(checklistKey([group], []) ?? '').find((step) => step.id === 'add')?.done).toBe(false)
  })

  it('goes away once every step is done', () => {
    expect(checklistKey([sticky('a', ['x']), sticky('b'), group], [edge])).toBeNull()
  })

  it('stays away on a canvas that is already large', () => {
    const many = Array.from({ length: CHECKLIST_MAX_NODES + 1 }, (_, i) => sticky(`n${i}`))
    expect(checklistKey(many, [])).toBeNull()
    expect(checklistKey(many.slice(0, CHECKLIST_MAX_NODES), [])).not.toBeNull()
  })
})

describe('stepsFromKey', () => {
  it('maps the key back to labelled steps in order', () => {
    expect(stepsFromKey('1010').map((step) => [step.id, step.done])).toEqual([
      ['add', true],
      ['connect', false],
      ['tag', true],
      ['group', false],
    ])
  })
})
