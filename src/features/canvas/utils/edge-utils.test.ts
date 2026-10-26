import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { checkConnection, createEdge, edgeFromConnection, isHandleSide, pickHandleSides } from './edge-utils'
import { createGroup, createStickyNote } from './node-factory'

const at = (id: string, x: number, y: number): CanvasNode => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y } })
const byId = (nodes: CanvasNode[]) => new Map(nodes.map((n) => [n.id, n]))

describe('checkConnection', () => {
  const a = at('a', 0, 0)
  const b = at('b', 400, 0)
  const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }

  it('accepts two different existing items', () => {
    expect(checkConnection([a, b], [], 'a', 'b')).toEqual({ ok: true })
  })

  it('rejects missing endpoints and self-connections', () => {
    expect(checkConnection([a, b], [], null, 'b').ok).toBe(false)
    expect(checkConnection([a, b], [], 'a', undefined).ok).toBe(false)
    expect(checkConnection([a, b], [], 'a', 'a')).toMatchObject({ ok: false })
  })

  it('rejects unknown items', () => {
    expect(checkConnection([a], [], 'a', 'zzz')).toMatchObject({ ok: false })
  })

  it('rejects groups (containers cannot be connected)', () => {
    expect(checkConnection([a, group], [], 'a', 'g')).toMatchObject({ ok: false })
    expect(checkConnection([a, group], [], 'g', 'a')).toMatchObject({ ok: false })
  })

  it('rejects a duplicate in the same direction but allows the reverse', () => {
    const edge = createEdge('a', 'b', 'right', 'left')
    expect(checkConnection([a, b], [edge], 'a', 'b')).toMatchObject({ ok: false })
    expect(checkConnection([a, b], [edge], 'b', 'a')).toEqual({ ok: true })
  })
})

describe('pickHandleSides', () => {
  const center = at('c', 1000, 1000)
  it.each([
    ['right', at('r', 1600, 1000), 'right', 'left'],
    ['left', at('l', 400, 1000), 'left', 'right'],
    ['below', at('d', 1000, 1600), 'bottom', 'top'],
    ['above', at('u', 1000, 400), 'top', 'bottom'],
  ])('target %s of the source', (_name, target, sourceHandle, targetHandle) => {
    expect(pickHandleSides(center, target, byId([center, target]))).toEqual({ sourceHandle, targetHandle })
  })

  it('uses the dominant axis for diagonal targets', () => {
    const wide = at('w', 1800, 1200)
    expect(pickHandleSides(center, wide, byId([center, wide])).sourceHandle).toBe('right')
    const tall = at('t', 1200, 1800)
    expect(pickHandleSides(center, tall, byId([center, tall])).sourceHandle).toBe('bottom')
  })
})

describe('createEdge / edgeFromConnection', () => {
  it('applies the default gradient arrow style, overridable per field', () => {
    const edge = createEdge('a', 'b', 'right', 'left', { label: 'x', lineStyle: 'dashed' })
    expect(edge).toMatchObject({ type: 'connection', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })
    expect(edge.data).toEqual({ curve: 'curved', lineStyle: 'dashed', arrow: 'end', color: 'gradient', label: 'x' })
  })

  it('creates unique ids', () => {
    expect(createEdge('a', 'b', 'top', 'top').id).not.toBe(createEdge('a', 'b', 'top', 'top').id)
  })

  it('falls back to safe handle sides for unknown handle ids', () => {
    const edge = edgeFromConnection({ source: 'a', target: 'b', sourceHandle: 'nope', targetHandle: null })
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
  })

  it('keeps valid handle ids from a drag', () => {
    const edge = edgeFromConnection({ source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' })
    expect([edge.sourceHandle, edge.targetHandle]).toEqual(['bottom', 'top'])
  })
})

describe('isHandleSide', () => {
  it('recognizes only the four sides', () => {
    expect(isHandleSide('top')).toBe(true)
    expect(isHandleSide('center')).toBe(false)
    expect(isHandleSide(null)).toBe(false)
  })
})
