import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createStickyNote } from '@/features/canvas/utils/node-factory'
import { MAX_CARD_HITS, searchCards, type SearchableWorkspace } from './card-search'

const sticky = (id: string, y: number, title: string, tags: string[] = []): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, position: { x: 0, y }, data: { ...node.data, title, tags } }
}
const index: SearchableWorkspace[] = [
  { id: 'w1', name: 'Roadmap', nodes: [sticky('b', 200, 'Launch plan'), sticky('a', 0, 'Plan the research', ['plan'])] },
  { id: 'w2', name: 'Reading', nodes: [sticky('c', 0, 'Café notes'), sticky('d', 50, 'أفكار المشروع')] },
]

describe('searchCards', () => {
  it('finds cards across workspaces, workspaces in the given order and cards in reading order', () => {
    expect(searchCards(index, 'plan').map((hit) => [hit.workspaceId, hit.nodeId])).toEqual([
      ['w1', 'a'],
      ['w1', 'b'],
    ])
  })

  it('reports the workspace and a readable label for each hit', () => {
    expect(searchCards(index, 'launch')[0]).toEqual({ workspaceId: 'w1', workspaceName: 'Roadmap', nodeId: 'b', label: 'Launch plan', kind: 'sticky' })
  })

  it('ignores case and accents, and supports Arabic and #tags', () => {
    expect(searchCards(index, 'CAFE').map((hit) => hit.nodeId)).toEqual(['c'])
    expect(searchCards(index, 'أفكار').map((hit) => hit.nodeId)).toEqual(['d'])
    expect(searchCards(index, '#plan').map((hit) => hit.nodeId)).toEqual(['a'])
  })

  it('returns nothing for a blank query or no match', () => {
    expect(searchCards(index, '   ')).toEqual([])
    expect(searchCards(index, 'zzz')).toEqual([])
    expect(searchCards([], 'plan')).toEqual([])
  })

  it('stops at the limit', () => {
    const many: SearchableWorkspace[] = [{ id: 'w', name: 'Big', nodes: Array.from({ length: 100 }, (_, i) => sticky(`n${i}`, i, 'match me')) }]
    expect(searchCards(many, 'match')).toHaveLength(MAX_CARD_HITS)
    expect(searchCards(many, 'match', 5)).toHaveLength(5)
  })
})
