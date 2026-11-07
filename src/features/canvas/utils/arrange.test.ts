import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { alignNodes, distributeNodes, layoutColumnsByStatus, layoutTree } from './arrange'
import { withStatus } from './card-flags'
import { createEdge } from './edge-utils'
import { createGroup, createStickyNote } from './node-factory'
import { getNodeSize } from './group-utils'

const sticky = (id: string, x: number, y: number): CanvasNode => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y }, selected: true })
const W = getNodeSize(sticky('w', 0, 0)).width
const H = getNodeSize(sticky('h', 0, 0)).height
const at = (placements: { id: string; position: { x: number; y: number } }[], id: string) => placements.find((p) => p.id === id)?.position

describe('alignNodes', () => {
  const nodes = [sticky('a', 0, 0), sticky('b', 400, 300), sticky('c', 900, 100)]

  it('aligns left edges to the leftmost card', () => {
    const result = alignNodes(nodes, nodes, 'left')
    expect(at(result, 'b')?.x).toBe(0)
    expect(at(result, 'c')?.x).toBe(0)
    expect(at(result, 'a')).toBeUndefined() // أصلاً في مكانه
    expect(at(result, 'b')?.y).toBe(300) // المحور الآخر لا يتغير
  })

  it('aligns right edges to the rightmost edge', () => {
    const result = alignNodes(nodes, nodes, 'right')
    expect(at(result, 'a')?.x).toBe(900)
    expect(at(result, 'b')?.x).toBe(900)
    expect(at(result, 'c')).toBeUndefined()
  })

  it('centers on the middle of the selection bounds', () => {
    const result = alignNodes(nodes, nodes, 'center')
    const center = (0 + (900 + W)) / 2
    expect(at(result, 'a')?.x).toBeCloseTo(center - W / 2)
  })

  it('aligns tops, bottoms and middles on the vertical axis', () => {
    expect(at(alignNodes(nodes, nodes, 'top'), 'b')?.y).toBe(0)
    expect(at(alignNodes(nodes, nodes, 'bottom'), 'a')?.y).toBe(300)
    const middle = (0 + (300 + H)) / 2
    expect(at(alignNodes(nodes, nodes, 'middle'), 'a')?.y).toBeCloseTo(middle - H / 2)
  })

  it('does nothing for fewer than two cards or when already aligned', () => {
    expect(alignNodes([nodes[0] as CanvasNode], nodes, 'left')).toEqual([])
    const row = [sticky('a', 0, 50), sticky('b', 300, 50)]
    expect(alignNodes(row, row, 'top')).toEqual([])
  })

  it('writes a member card back in its group-relative coordinates', () => {
    const frame = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 1000, y: 1000 }, selected: false }
    const inside: CanvasNode = { ...sticky('m', 50, 80), parentId: 'g' } // مطلق: 1050,1080
    const outside = sticky('o', 200, 0)
    const all = [frame, inside, outside]
    const result = alignNodes([inside, outside], all, 'left')
    // أقصى اليسار هو البطاقة الخارجية (x=200)؛ العضو يُنقل إلى x مطلق 200 = نسبي -800
    expect(at(result, 'm')?.x).toBe(-800)
    expect(at(result, 'o')).toBeUndefined()
  })

  it('ignores a member whose group is selected too (it moves with the group)', () => {
    const frame = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 0, y: 0 }, selected: true }
    const inside: CanvasNode = { ...sticky('m', 20, 20), parentId: 'g' }
    const other = sticky('o', 900, 900)
    const result = alignNodes([frame, inside, other], [frame, inside, other], 'left')
    expect(result.map((p) => p.id)).not.toContain('m')
  })
})

describe('distributeNodes', () => {
  it('spaces three cards with equal gaps and keeps the outer two in place', () => {
    const nodes = [sticky('a', 0, 0), sticky('b', 100, 0), sticky('c', 1000, 0)]
    const result = distributeNodes(nodes, nodes, 'horizontal')
    const gap = (1000 + W - 0 - 3 * W) / 2
    expect(at(result, 'a')).toBeUndefined()
    expect(at(result, 'c')).toBeUndefined()
    expect(at(result, 'b')?.x).toBeCloseTo(W + gap)
  })

  it('works vertically and sorts by position, not selection order', () => {
    const nodes = [sticky('c', 0, 900), sticky('a', 0, 0), sticky('b', 0, 50)]
    const result = distributeNodes(nodes, nodes, 'vertical')
    const gap = (900 + H - 3 * H) / 2
    expect(at(result, 'b')?.y).toBeCloseTo(H + gap)
  })

  it('needs at least three cards', () => {
    const two = [sticky('a', 0, 0), sticky('b', 500, 0)]
    expect(distributeNodes(two, two, 'horizontal')).toEqual([])
  })

  it('does nothing when the spacing is already even', () => {
    const gap = 100
    const even = [sticky('a', 0, 0), sticky('b', W + gap, 0), sticky('c', 2 * (W + gap), 0)]
    expect(distributeNodes(even, even, 'horizontal')).toEqual([])
  })
})

const link = (source: string, target: string) => ({ ...createEdge(source, target, 'right', 'left'), id: `${source}-${target}` })
const GAP = 24

describe('layoutColumnsByStatus', () => {
  const todo = sticky('t1', 0, 0)
  const todo2 = sticky('t2', 300, 600)
  const doing = withStatus(sticky('d1', 900, 50), 'doing', 1)
  const done = withStatus(sticky('x1', 50, 900), 'done', 1)
  const nodes = [todo, todo2, doing, done]

  it('puts none, in progress and done in three left-to-right columns from the top-left of the selection', () => {
    const result = layoutColumnsByStatus(nodes, nodes)
    const pos = (id: string) => at(result, id) ?? nodes.find((n) => n.id === id)?.position
    expect(pos('t1')).toEqual({ x: 0, y: 0 })
    expect(pos('d1')?.x).toBeGreaterThan((pos('t1')?.x ?? 0) + W - 1)
    expect(pos('x1')?.x).toBeGreaterThan(pos('d1')?.x ?? 0)
    expect(pos('d1')?.y).toBe(0)
    expect(pos('x1')?.y).toBe(0)
  })

  it('stacks cards of one status without overlap, keeping their top-to-bottom order', () => {
    const result = layoutColumnsByStatus(nodes, nodes)
    expect(at(result, 't2')).toEqual({ x: 0, y: H + GAP })
  })

  it('does nothing for fewer than two cards and ignores groups', () => {
    expect(layoutColumnsByStatus([todo], [todo])).toEqual([])
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', selected: true }
    expect(layoutColumnsByStatus([group, todo], [group, todo])).toEqual([])
  })

  it('never moves cards to a position they already have', () => {
    const first = layoutColumnsByStatus(nodes, nodes)
    const moved = nodes.map((n) => ({ ...n, position: at(first, n.id) ?? n.position }))
    expect(layoutColumnsByStatus(moved, moved)).toEqual([])
  })
})

describe('layoutTree', () => {
  it('lays a chain out left to right, one column per depth, all at the same height', () => {
    const nodes = [sticky('a', 500, 500), sticky('b', 0, 0), sticky('c', 900, 900)]
    const result = layoutTree(nodes, nodes, [link('a', 'b'), link('b', 'c')])
    const a = at(result, 'a') ?? { x: 500, y: 500 }
    const b = at(result, 'b') ?? { x: 0, y: 0 }
    const c = at(result, 'c') ?? { x: 900, y: 900 }
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(c.x)
    expect(new Set([a.y, b.y, c.y]).size).toBe(1)
  })

  it('stacks siblings in their current top-to-bottom order and centers the parent between them', () => {
    const nodes = [sticky('root', 0, 0), sticky('low', 600, 700), sticky('high', 600, 100)]
    const result = layoutTree(nodes, nodes, [link('root', 'low'), link('root', 'high')])
    const high = at(result, 'high') ?? { x: 0, y: 0 }
    const low = at(result, 'low') ?? { x: 0, y: 0 }
    const root = at(result, 'root') ?? { x: 0, y: 0 }
    expect(high.y).toBeLessThan(low.y)
    expect(low.y - high.y).toBe(H + GAP)
    expect(root.y + H / 2).toBeCloseTo((high.y + low.y + H) / 2, 5)
    expect(high.x).toBe(low.x)
  })

  it('does not overlap two separate trees', () => {
    const nodes = [sticky('a', 0, 0), sticky('a1', 300, 0), sticky('b', 0, 500), sticky('b1', 300, 500)]
    const result = layoutTree(nodes, nodes, [link('a', 'a1'), link('b', 'b1')])
    const ys = ['a', 'b'].map((id) => (at(result, id) ?? nodes.find((n) => n.id === id)?.position)?.y ?? 0)
    expect(Math.abs((ys[1] as number) - (ys[0] as number))).toBeGreaterThanOrEqual(H + GAP)
  })

  it('terminates on cycles and self loops and places every card once', () => {
    const nodes = [sticky('a', 0, 0), sticky('b', 300, 0), sticky('c', 600, 0)]
    const result = layoutTree(nodes, nodes, [link('a', 'b'), link('b', 'c'), link('c', 'a'), link('a', 'a')])
    const moved = new Set(result.map((r) => r.id))
    for (const id of moved) expect(nodes.some((n) => n.id === id)).toBe(true)
    const positions = nodes.map((n) => at(result, n.id) ?? n.position)
    expect(new Set(positions.map((q) => `${q.x},${q.y}`)).size).toBe(3)
  })

  it('places a card with two parents once, under the first parent that reaches it', () => {
    const nodes = [sticky('p1', 0, 0), sticky('p2', 0, 400), sticky('kid', 500, 200)]
    const result = layoutTree(nodes, nodes, [link('p1', 'kid'), link('p2', 'kid')])
    expect(result.filter((r) => r.id === 'kid').length).toBeLessThanOrEqual(1)
  })

  it('ignores connections to cards outside the selection', () => {
    const inside = [sticky('a', 0, 0), sticky('b', 300, 0)]
    const outside = sticky('z', 0, 800)
    const result = layoutTree(inside, [...inside, outside], [link('a', 'z'), link('z', 'b')])
    expect(result.some((r) => r.id === 'z')).toBe(false)
  })

  it('handles a very long chain without overflowing the stack', () => {
    const nodes = Array.from({ length: 3000 }, (_, i) => sticky(`n${i}`, i, 0))
    const edges = nodes.slice(1).map((n, i) => link(`n${i}`, n.id))
    expect(() => layoutTree(nodes, nodes, edges)).not.toThrow()
  })

  it('does nothing for fewer than two cards', () => {
    const one = [sticky('a', 0, 0)]
    expect(layoutTree(one, one, [])).toEqual([])
  })
})
