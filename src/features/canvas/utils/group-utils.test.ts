import { describe, expect, it } from 'vitest'
import type { CanvasNode, GroupContainer, StickyNote } from '../types/nodes'
import {
  findContainingGroup,
  getAbsolutePosition,
  reconcileAllMembership,
  reconcileMembership,
  releaseChildren,
  sortGroupsFirst,
} from './group-utils'
import { createGroup, createStickyNote } from './node-factory'
import { NODE_SIZES } from './constants'

const group = (id: string, x: number, y: number, width = 600, height = 400): GroupContainer => ({
  ...createGroup({ x: 0, y: 0 }, 1),
  id,
  position: { x, y },
  width,
  height,
})

const sticky = (id: string, x: number, y: number): StickyNote => ({
  ...createStickyNote({ x: 0, y: 0 }, 1),
  id,
  position: { x, y },
})

const find = (nodes: CanvasNode[], id: string) => nodes.find((n) => n.id === id)

describe('sortGroupsFirst', () => {
  it('moves groups to the front, preserving relative order', () => {
    const a = sticky('a', 0, 0)
    const g1 = group('g1', 0, 0)
    const b = sticky('b', 0, 0)
    const g2 = group('g2', 0, 0)
    expect(sortGroupsFirst([a, g1, b, g2]).map((n) => n.id)).toEqual(['g1', 'g2', 'a', 'b'])
  })

  it('returns the same array when already sorted (no needless re-render)', () => {
    const nodes = [group('g', 0, 0), sticky('a', 0, 0)]
    expect(sortGroupsFirst(nodes)).toBe(nodes)
  })
})

describe('getAbsolutePosition', () => {
  it('adds the parent position to a member position', () => {
    const g = group('g', 100, 200)
    const member = { ...sticky('m', 30, 40), parentId: 'g' }
    expect(getAbsolutePosition(member, new Map([['g', g]]))).toEqual({ x: 130, y: 240 })
  })

  it('returns the position as is for top-level nodes', () => {
    expect(getAbsolutePosition(sticky('a', 5, 6), new Map())).toEqual({ x: 5, y: 6 })
  })
})

describe('findContainingGroup', () => {
  it('returns the smallest group that contains the point', () => {
    const outer = group('outer', 0, 0, 1000, 800)
    const inner = group('inner', 100, 100, 300, 300)
    expect(findContainingGroup({ x: 200, y: 200 }, [outer, inner])?.id).toBe('inner')
    expect(findContainingGroup({ x: 800, y: 700 }, [outer, inner])?.id).toBe('outer')
  })

  it('returns undefined outside every group', () => {
    expect(findContainingGroup({ x: 5000, y: 5000 }, [group('g', 0, 0)])).toBeUndefined()
  })
})

describe('reconcileMembership', () => {
  it('adds a node whose center is inside a group, converting to relative coordinates', () => {
    const g = group('g', 100, 100)
    const a = sticky('a', 200, 200) // مركزه (316,304) داخل المجموعة (100..700 × 100..500)
    const result = reconcileMembership([g, a], new Set(['a']))
    const moved = find(result, 'a')
    expect(moved?.parentId).toBe('g')
    expect(moved?.position).toEqual({ x: 100, y: 100 })
    expect(getAbsolutePosition(moved as CanvasNode, new Map([['g', g]]))).toEqual({ x: 200, y: 200 })
  })

  it('does not add a node whose center is outside, even if it overlaps the edge', () => {
    const g = group('g', 0, 0, 400, 300)
    // الورقة (عرضها 232) تتداخل مع الحافة اليمنى لكن مركزها عند x=496، خارج المجموعة التي تنتهي عند 400
    const a = sticky('a', 380, 50)
    const result = reconcileMembership([g, a], new Set(['a']))
    expect(find(result, 'a')?.parentId).toBeUndefined()
  })

  it('releases a member dragged out, converting back to absolute coordinates', () => {
    const g = group('g', 100, 100, 400, 300)
    const member = { ...sticky('m', 0, 0), parentId: 'g', position: { x: 900, y: 900 } }
    const result = reconcileMembership([g, member], new Set(['m']))
    const released = find(result, 'm')
    expect(released?.parentId).toBeUndefined()
    expect(released?.position).toEqual({ x: 1000, y: 1000 })
  })

  it('keeps references and returns the same array when nothing changes', () => {
    const g = group('g', 0, 0)
    const free = sticky('a', 5000, 5000)
    const nodes: CanvasNode[] = [g, free]
    expect(reconcileMembership(nodes, new Set(['a']))).toBe(nodes)
  })

  it('ignores nodes that were not moved and never makes groups members', () => {
    const outer = group('outer', 0, 0, 1000, 800)
    const inner = group('inner', 100, 100, 300, 300)
    const free = sticky('a', 120, 120)
    const result = reconcileMembership([outer, inner, free], new Set(['inner']))
    expect(find(result, 'inner')?.parentId).toBeUndefined()
    expect(find(result, 'a')?.parentId).toBeUndefined()
  })

  it('moves a node between two groups', () => {
    const left = group('left', 0, 0, 400, 400)
    const right = group('right', 1000, 0, 400, 400)
    const member = { ...sticky('m', 0, 0), parentId: 'left', position: { x: 1050, y: 50 } } // نسبي إلى left => مطلق (1050,50)
    const result = reconcileMembership([left, right, member], new Set(['m']))
    expect(find(result, 'm')?.parentId).toBe('right')
    expect(find(result, 'm')?.position).toEqual({ x: 50, y: 50 })
  })
})

describe('reconcileAllMembership (after resizing a group)', () => {
  it('captures nodes the group now covers and releases ones it no longer covers', () => {
    const half = NODE_SIZES.sticky.width / 2
    const g = group('g', 0, 0, 600, 400)
    const captured = sticky('captured', 100, 100)
    const stays = { ...sticky('stays', 0, 0), parentId: 'g', position: { x: 50, y: 50 } }
    const leaves = { ...sticky('leaves', 0, 0), parentId: 'g', position: { x: 580 + half, y: 50 } }
    const result = reconcileAllMembership([g, captured, stays, leaves])
    expect(find(result, 'captured')?.parentId).toBe('g')
    expect(find(result, 'stays')?.parentId).toBe('g')
    expect(find(result, 'leaves')?.parentId).toBeUndefined()
  })
})

describe('releaseChildren (before deleting a group)', () => {
  it('frees the members at their absolute positions', () => {
    const g = group('g', 100, 100)
    const member = { ...sticky('m', 0, 0), parentId: 'g', position: { x: 10, y: 20 } }
    const result = releaseChildren([g, member], new Set(['g']))
    const freed = find(result, 'm')
    expect(freed?.parentId).toBeUndefined()
    expect(freed?.position).toEqual({ x: 110, y: 120 })
  })

  it('leaves alone members that are being removed too', () => {
    const g = group('g', 100, 100)
    const member = { ...sticky('m', 0, 0), parentId: 'g', position: { x: 10, y: 20 } }
    const result = releaseChildren([g, member], new Set(['g']), new Set(['m']))
    expect(find(result, 'm')?.parentId).toBe('g')
  })

  it('does nothing when no group is being removed', () => {
    const nodes: CanvasNode[] = [group('g', 0, 0)]
    expect(releaseChildren(nodes, new Set())).toBe(nodes)
  })
})
