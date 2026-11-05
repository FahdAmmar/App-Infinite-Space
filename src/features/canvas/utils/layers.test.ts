import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { reorderLayers } from './layers'
import { createGroup, createStickyNote } from './node-factory'

const card = (id: string): CanvasNode => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id })
const group = (id: string): CanvasNode => ({ ...createGroup({ x: 0, y: 0 }, 1), id })
const ids = (nodes: readonly CanvasNode[]) => nodes.map((n) => n.id)

describe('reorderLayers', () => {
  const nodes = [group('g'), card('a'), card('b'), card('c'), card('d')]

  it('brings the selection to the front, keeping its own relative order', () => {
    expect(ids(reorderLayers(nodes, new Set(['b', 'a']), 'front'))).toEqual(['g', 'c', 'd', 'a', 'b'])
  })

  it('sends the selection to the back, behind every other card', () => {
    expect(ids(reorderLayers(nodes, new Set(['d', 'c']), 'back'))).toEqual(['g', 'c', 'd', 'a', 'b'])
  })

  it('never moves a card behind a group (groups stay first)', () => {
    expect(ids(reorderLayers(nodes, new Set(['d']), 'back'))[0]).toBe('g')
  })

  it('orders groups among themselves without letting a card pass them', () => {
    const mixed = [group('g1'), group('g2'), card('a')]
    expect(ids(reorderLayers(mixed, new Set(['g1']), 'front'))).toEqual(['g2', 'g1', 'a'])
    expect(ids(reorderLayers(mixed, new Set(['a']), 'back'))).toEqual(['g1', 'g2', 'a'])
  })

  it('returns the same array when nothing would change', () => {
    expect(reorderLayers(nodes, new Set(['d']), 'front')).toBe(nodes)
    expect(reorderLayers(nodes, new Set(['a']), 'back')).toBe(nodes)
    expect(reorderLayers(nodes, new Set(), 'front')).toBe(nodes)
    expect(reorderLayers(nodes, new Set(['missing']), 'front')).toBe(nodes)
  })

  it('does not mutate its input', () => {
    const copy = [...nodes]
    reorderLayers(nodes, new Set(['a']), 'front')
    expect(nodes).toEqual(copy)
  })
})
