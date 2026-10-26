import { describe, expect, it } from 'vitest'
import { edgesContentEqual, nodesContentEqual } from './canvas-equality'
import { createEdge } from './edge-utils'
import { createStickyNote } from './node-factory'

const note = createStickyNote({ x: 0, y: 0 }, 1)

describe('nodesContentEqual', () => {
  it('ignores selection, dragging and measured state (new objects, same content)', () => {
    const noisy = { ...note, selected: true, dragging: true, measured: { width: 1, height: 2 }, position: { ...note.position } }
    expect(nodesContentEqual([note], [noisy])).toBe(true)
  })

  it('detects data, position, size and parent changes', () => {
    expect(nodesContentEqual([note], [{ ...note, data: { ...note.data } }])).toBe(false)
    expect(nodesContentEqual([note], [{ ...note, position: { x: note.position.x + 1, y: note.position.y } }])).toBe(false)
    expect(nodesContentEqual([note], [{ ...note, width: 999 }])).toBe(false)
    expect(nodesContentEqual([note], [{ ...note, parentId: 'g' }])).toBe(false)
  })

  it('detects additions, removals and reordering', () => {
    const other = createStickyNote({ x: 5, y: 5 }, 1)
    expect(nodesContentEqual([note], [])).toBe(false)
    expect(nodesContentEqual([note, other], [other, note])).toBe(false)
  })
})

describe('edgesContentEqual', () => {
  const edge = createEdge('a', 'b', 'right', 'left')
  it('ignores selection but not endpoints, handles or data', () => {
    expect(edgesContentEqual([edge], [{ ...edge, selected: true }])).toBe(true)
    expect(edgesContentEqual([edge], [{ ...edge, target: 'c' }])).toBe(false)
    expect(edgesContentEqual([edge], [{ ...edge, sourceHandle: 'top' }])).toBe(false)
    expect(edgesContentEqual([edge], [{ ...edge, data: edge.data ? { ...edge.data } : edge.data }])).toBe(false)
  })
})
