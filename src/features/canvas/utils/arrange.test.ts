import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { alignNodes, distributeNodes } from './arrange'
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
