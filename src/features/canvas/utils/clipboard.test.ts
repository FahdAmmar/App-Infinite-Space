import { afterEach, describe, expect, it } from 'vitest'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { buildClipboard, clipboardCenter, clipboardMarker, getHeldClipboard, isClipboardMarker, preparePaste, setHeldClipboard } from './clipboard'
import { createEdge } from './edge-utils'
import { createGroup, createStickyNote } from './node-factory'

const sticky = (id: string, x: number, y: number, selected = true): CanvasNode => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y }, selected })
const member = (id: string, parentId: string, x: number, y: number, selected = false): CanvasNode => ({ ...sticky(id, x, y, selected), parentId })
const group = (id: string, x: number, y: number, selected = true): CanvasNode => ({ ...createGroup({ x: 0, y: 0 }, 1), id, position: { x, y }, selected })
const edge = (source: string, target: string): CanvasEdge => createEdge(source, target, 'right', 'left')

afterEach(() => setHeldClipboard(null))

describe('clipboard marker', () => {
  it('recognizes only the sentence this app writes', () => {
    expect(isClipboardMarker(clipboardMarker(1))).toBe(true)
    expect(isClipboardMarker(clipboardMarker(12))).toBe(true)
    expect(isClipboardMarker(`  ${clipboardMarker(3)}\n`)).toBe(true)
    expect(clipboardMarker(1)).toBe('InfiniteSpace: 1 item copied')
    for (const other of ['', 'hello', 'InfiniteSpace: items copied', 'InfiniteSpace: 2 items copied and more', null, undefined]) {
      expect(isClipboardMarker(other)).toBe(false)
    }
  })
})

describe('buildClipboard', () => {
  it('returns null when nothing is selected', () => {
    expect(buildClipboard([sticky('a', 0, 0, false)], [])).toBeNull()
  })

  it('keeps only connections whose both ends are copied', () => {
    const nodes = [sticky('a', 0, 0), sticky('b', 300, 0), sticky('c', 600, 0, false)]
    const clip = buildClipboard(nodes, [edge('a', 'b'), edge('b', 'c')])
    expect(clip?.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(clip?.edges).toHaveLength(1)
  })

  it('copies the members of a selected group', () => {
    const nodes = [group('g', 100, 100), member('m', 'g', 20, 30), sticky('other', 900, 900, false)]
    const clip = buildClipboard(nodes, [])
    expect(clip?.nodes.map((n) => n.id).sort()).toEqual(['g', 'm'])
    expect(clip?.nodes.find((n) => n.id === 'm')?.parentId).toBe('g')
  })

  it('detaches a selected card from a group that is not copied, using absolute coordinates', () => {
    const nodes = [group('g', 100, 100, false), member('m', 'g', 20, 30, true)]
    const clip = buildClipboard(nodes, [])
    const copied = clip?.nodes[0]
    expect(copied?.parentId).toBeUndefined()
    expect(copied?.position).toEqual({ x: 120, y: 130 })
  })
})

describe('preparePaste', () => {
  it('creates new ids, centers the copy on the target, and remaps connections', () => {
    const clip = buildClipboard([sticky('a', 0, 0), sticky('b', 400, 0)], [edge('a', 'b')])
    if (!clip) throw new Error('no clip')
    const target = { x: 1000, y: 500 }
    const pasted = preparePaste(clip, target, 99)

    expect(pasted.nodes.map((n) => n.id)).not.toContain('a')
    expect(pasted.nodes.map((n) => n.id)).not.toContain('b')
    const center = clipboardCenter(pasted)
    expect(center.x).toBeCloseTo(target.x)
    expect(center.y).toBeCloseTo(target.y)
    expect(pasted.edges).toHaveLength(1)
    const ids = new Set(pasted.nodes.map((n) => n.id))
    expect(ids.has(pasted.edges[0]?.source ?? '')).toBe(true)
    expect(ids.has(pasted.edges[0]?.target ?? '')).toBe(true)
    expect(pasted.edges[0]?.id).not.toBe(clip.edges[0]?.id)
  })

  it('does not change the clipboard, so it can be pasted again', () => {
    const clip = buildClipboard([sticky('a', 0, 0)], [])
    if (!clip) throw new Error('no clip')
    const first = preparePaste(clip, { x: 10, y: 10 }, 1)
    const second = preparePaste(clip, { x: 10, y: 10 }, 2)
    expect(first.nodes[0]?.id).not.toBe(second.nodes[0]?.id)
    expect(clip.nodes[0]?.id).toBe('a')
    expect(clip.nodes[0]?.position).toEqual({ x: 0, y: 0 })
  })

  it('moves a pasted group with its members, which keep their relative position', () => {
    const clip = buildClipboard([group('g', 0, 0), member('m', 'g', 20, 30)], [])
    if (!clip) throw new Error('no clip')
    const pasted = preparePaste(clip, { x: 2000, y: 2000 }, 1)
    const pastedGroup = pasted.nodes.find((n) => n.type === 'group')
    const pastedMember = pasted.nodes.find((n) => n.type === 'sticky')
    expect(pastedMember?.parentId).toBe(pastedGroup?.id)
    expect(pastedMember?.position).toEqual({ x: 20, y: 30 })
    expect(pastedGroup?.position.x).not.toBe(0)
  })

  it('stamps fresh creation times', () => {
    const clip = buildClipboard([sticky('a', 0, 0)], [])
    if (!clip) throw new Error('no clip')
    const node = preparePaste(clip, { x: 0, y: 0 }, 777).nodes[0]
    expect(node?.type === 'sticky' && node.data.createdAt).toBe(777)
  })
})

describe('held clipboard', () => {
  it('survives until replaced (this is what lets a paste work in another workspace)', () => {
    expect(getHeldClipboard()).toBeNull()
    const clip = buildClipboard([sticky('a', 0, 0)], [])
    setHeldClipboard(clip)
    expect(getHeldClipboard()).toBe(clip)
  })
})
