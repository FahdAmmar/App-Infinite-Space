import { describe, expect, it } from 'vitest'
import { createEdge } from './edge-utils'
import { getNodeLinks } from './links'
import { createStickyNote } from './node-factory'

const note = (id: string, title: string) => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, data: { ...node.data, title } }
}
const edge = (id: string, source: string, target: string, label = '') => ({ ...createEdge(source, target, 'right', 'left', label ? { label } : undefined), id })

describe('getNodeLinks', () => {
  const nodes = [note('a', 'Alpha'), note('b', 'Beta'), note('c', 'Gamma')]

  it('separates outgoing and incoming connections with the other card’s name and the line text', () => {
    const links = getNodeLinks('b', nodes, [edge('e1', 'a', 'b', 'leads to'), edge('e2', 'b', 'c')])
    expect(links.incoming).toEqual([{ edgeId: 'e1', nodeId: 'a', label: 'Alpha', edgeLabel: 'leads to' }])
    expect(links.outgoing).toEqual([{ edgeId: 'e2', nodeId: 'c', label: 'Gamma', edgeLabel: '' }])
  })

  it('returns empty lists for a card with no connections', () => {
    expect(getNodeLinks('c', nodes, [edge('e1', 'a', 'b')])).toEqual({ outgoing: [], incoming: [] })
  })

  it('skips self loops and connections to missing cards', () => {
    const links = getNodeLinks('a', nodes, [edge('e1', 'a', 'a'), edge('e2', 'a', 'ghost'), edge('e3', 'ghost', 'a')])
    expect(links).toEqual({ outgoing: [], incoming: [] })
  })

  it('keeps the order of the connections on the canvas', () => {
    const links = getNodeLinks('a', nodes, [edge('e1', 'a', 'c'), edge('e2', 'a', 'b')])
    expect(links.outgoing.map((l) => l.nodeId)).toEqual(['c', 'b'])
  })
})
