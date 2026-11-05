import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { createGroup, createLinkCard, createStickyNote } from './node-factory'
import { buildOutline, nodeLabel } from './outline'

const sticky = (id: string, x: number, y: number, title = '', content = '', parentId?: string): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, position: { x, y }, ...(parentId ? { parentId } : {}), data: { ...node.data, title, content } }
}
const group = (id: string, x: number, y: number, label: string): CanvasNode => {
  const node = createGroup({ x: 0, y: 0 }, 1)
  return { ...node, id, position: { x, y }, data: { ...node.data, label } }
}

describe('nodeLabel', () => {
  it('prefers the title, then the first non-empty content line, then a fallback', () => {
    expect(nodeLabel(sticky('a', 0, 0, 'Plan', 'body'))).toBe('Plan')
    expect(nodeLabel(sticky('a', 0, 0, '', '\n\n  First line\nsecond'))).toBe('First line')
    expect(nodeLabel(sticky('a', 0, 0))).toBe('Empty note')
  })

  it('shows a link by its title or host', () => {
    const link = createLinkCard({ x: 0, y: 0 }, 1)
    expect(nodeLabel({ ...link, data: { ...link.data, url: 'https://example.com/a/b?x=1' } })).toBe('example.com')
    expect(nodeLabel({ ...link, data: { ...link.data, url: 'https://example.com', title: 'Docs' } })).toBe('Docs')
    expect(nodeLabel(link)).toBe('Empty link')
  })

  it('names an unnamed group and cuts very long labels', () => {
    expect(nodeLabel(group('g', 0, 0, '  '))).toBe('Untitled group')
    expect(nodeLabel(sticky('a', 0, 0, 'x'.repeat(200))).length).toBe(80)
  })

  it('works with Arabic text', () => {
    expect(nodeLabel(sticky('a', 0, 0, 'أفكار المشروع'))).toBe('أفكار المشروع')
  })
})

describe('buildOutline', () => {
  it('lists each group followed by its cards, then free cards, in reading order', () => {
    const nodes = [
      sticky('free2', 500, 400, 'Free B'),
      group('g2', 600, 0, 'Right group'),
      sticky('m1', 20, 80, 'Member low', '', 'g1'),
      group('g1', 0, 0, 'Left group'),
      sticky('m0', 20, 10, 'Member high', '', 'g1'),
      sticky('free1', 100, 300, 'Free A'),
    ]
    expect(buildOutline(nodes).map((entry) => [entry.label, entry.depth])).toEqual([
      ['Left group', 0],
      ['Member high', 1],
      ['Member low', 1],
      ['Right group', 0],
      ['Free A', 0],
      ['Free B', 0],
    ])
  })

  it('reports how many cards a group holds', () => {
    const nodes = [group('g', 0, 0, 'G'), sticky('a', 0, 0, 'A', '', 'g'), sticky('b', 0, 0, 'B', '', 'g')]
    expect(buildOutline(nodes)[0]).toMatchObject({ kind: 'group', childCount: 2 })
  })

  it('treats a card whose group is missing as free rather than losing it', () => {
    expect(buildOutline([sticky('a', 0, 0, 'Orphan', '', 'gone')]).map((entry) => entry.label)).toEqual(['Orphan'])
  })

  it('is empty for an empty canvas', () => {
    expect(buildOutline([])).toEqual([])
  })
})
