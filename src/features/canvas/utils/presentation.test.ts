import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { createGroup, createStickyNote } from './node-factory'
import { orderSlides, slideRect, slideTitle, stepSlide } from './presentation'

const group = (id: string, x: number, y: number, label = ''): CanvasNode => {
  const base = createGroup({ x: 0, y: 0 }, 1)
  return { ...base, id, position: { x, y }, data: { ...base.data, label } } as CanvasNode
}
const ids = (nodes: CanvasNode[]) => orderSlides(nodes).map((node) => node.id)

describe('orderSlides', () => {
  it('uses only groups and ignores every other card', () => {
    const note = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'n' }
    expect(ids([note, group('g', 0, 0)])).toEqual(['g'])
  })

  it('reads rows top to bottom and left to right', () => {
    const grid = [group('d', 700, 600), group('b', 700, 0), group('c', 0, 600), group('a', 0, 0)]
    expect(ids(grid)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps two neighbours in one row when one sits slightly lower', () => {
    const nodes = [group('right', 700, 40), group('left', 0, 0)]
    expect(ids(nodes)).toEqual(['left', 'right'])
  })

  it('starts a new row once the vertical gap is large', () => {
    const nodes = [group('lower-left', 0, 400), group('upper-right', 900, 0)]
    expect(ids(nodes)).toEqual(['upper-right', 'lower-left'])
  })

  it('returns nothing when there are no groups', () => {
    expect(ids([])).toEqual([])
  })
})

describe('slideRect and slideTitle', () => {
  it('uses the group position and its size', () => {
    const rect = slideRect(group('g', 120, 80))
    expect(rect.x).toBe(120)
    expect(rect.y).toBe(80)
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it('titles a slide by its label or by its number', () => {
    expect(slideTitle(group('g', 0, 0, '  Intro  '), 0)).toBe('Intro')
    expect(slideTitle(group('g', 0, 0, ''), 2)).toBe('Slide 3')
    expect(slideTitle(group('g', 0, 0, '   '), 0)).toBe('Slide 1')
    expect(slideTitle(group('g', 0, 0, 'مقدمة'), 1)).toBe('مقدمة')
  })
})

describe('stepSlide', () => {
  it('moves one slide and stops at both ends without wrapping', () => {
    expect(stepSlide(1, 5, 1)).toBe(2)
    expect(stepSlide(4, 5, 1)).toBe(4)
    expect(stepSlide(0, 5, -1)).toBe(0)
    expect(stepSlide(3, 5, -1)).toBe(2)
  })

  it('jumps to the first and last slide', () => {
    expect(stepSlide(2, 5, 'first')).toBe(0)
    expect(stepSlide(2, 5, 'last')).toBe(4)
  })

  it('is safe with no slides', () => {
    expect(stepSlide(0, 0, 1)).toBe(0)
    expect(stepSlide(3, 0, 'last')).toBe(0)
  })
})
