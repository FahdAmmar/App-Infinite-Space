import type { NodeChange } from '@xyflow/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createStickyNote, createTextCard } from '@/features/canvas/utils/node-factory'
import { createCanvasStore, type CanvasStoreApi } from './canvas-store'
import { selectSelectedCount, selectSelectedIds } from './canvas-selectors'

let store: CanvasStoreApi
const nodes = () => store.getState().nodes
const byId = (id: string): CanvasNode | undefined => nodes().find((n) => n.id === id)

beforeEach(() => {
  store = createCanvasStore()
})

describe('addNode', () => {
  it('adds the node selected and deselects the others', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createTextCard({ x: 300, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().addNode(b)
    expect(byId(a.id)?.selected).toBe(false)
    expect(byId(b.id)?.selected).toBe(true)
    expect(selectSelectedIds(store.getState())).toEqual([b.id])
  })

  it('keeps references of untouched nodes (so they are not re-rendered)', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().clearSelection()
    const before = byId(a.id)
    store.getState().addNode(createStickyNote({ x: 500, y: 0 }, 1))
    expect(byId(a.id)).toBe(before)
  })
})

describe('applyNodeChanges (from React Flow)', () => {
  it('applies position changes from dragging', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    const change: NodeChange<CanvasNode> = { type: 'position', id: a.id, position: { x: 50, y: 60 }, dragging: true }
    store.getState().applyNodeChanges([change])
    expect(byId(a.id)?.position).toEqual({ x: 50, y: 60 })
  })

  it('applies selection and dimension (resize) changes', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().applyNodeChanges([
      { type: 'select', id: a.id, selected: false },
      { type: 'dimensions', id: a.id, dimensions: { width: 300, height: 260 }, setAttributes: true },
    ])
    expect(byId(a.id)).toMatchObject({ selected: false, width: 300, height: 260 })
  })

  it('removes nodes and ends editing when the edited node is deleted', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().startEditing(a.id)
    store.getState().applyNodeChanges([{ type: 'remove', id: a.id }])
    expect(nodes()).toHaveLength(0)
    expect(store.getState().editingNodeId).toBeNull()
  })
})

describe('updateStickyNote / updateTextCard', () => {
  it('merges the patch and bumps updatedAt, leaving createdAt alone', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1000)
    store.getState().addNode(a)
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    store.getState().updateStickyNote(a.id, { title: 'Hello', color: 'blue' })
    const updated = byId(a.id)
    expect(updated?.type === 'sticky' && updated.data).toMatchObject({ title: 'Hello', color: 'blue', createdAt: 1000, updatedAt: 5000 })
  })

  it('ignores a patch aimed at a node of the other type', () => {
    const text = createTextCard({ x: 0, y: 0 }, 1)
    store.getState().addNode(text)
    store.getState().updateStickyNote(text.id, { title: 'nope' })
    const titleOf = () => {
      const node = byId(text.id)
      return node?.type === 'text' ? node.data.title : undefined
    }
    expect(titleOf()).toBe('')
    store.getState().updateTextCard(text.id, { title: 'yes' })
    expect(titleOf()).toBe('yes')
  })
})

describe('removeNodes', () => {
  it('removes only the given ids', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 10, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().addNode(b)
    store.getState().removeNodes([a.id])
    expect(nodes().map((n) => n.id)).toEqual([b.id])
  })
})

describe('selection', () => {
  it('selectAll / clearSelection toggle every node', () => {
    store.getState().addNode(createStickyNote({ x: 0, y: 0 }, 1))
    store.getState().addNode(createStickyNote({ x: 10, y: 0 }, 1))
    store.getState().selectAll()
    expect(selectSelectedCount(store.getState())).toBe(2)
    store.getState().clearSelection()
    expect(selectSelectedCount(store.getState())).toBe(0)
  })
})

describe('duplicateSelected', () => {
  it('does nothing when nothing is selected', () => {
    store.getState().addNode(createStickyNote({ x: 0, y: 0 }, 1))
    store.getState().clearSelection()
    expect(store.getState().duplicateSelected()).toEqual([])
    expect(nodes()).toHaveLength(1)
  })

  it('duplicates the selection, selects only the copies, and returns their ids', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    const ids = store.getState().duplicateSelected()
    expect(ids).toHaveLength(1)
    expect(nodes()).toHaveLength(2)
    expect(byId(a.id)?.selected).toBe(false)
    expect(selectSelectedIds(store.getState())).toEqual(ids)
  })
})

describe('editor state', () => {
  it('startEditing switches back to the select tool', () => {
    store.getState().setTool('sticky')
    store.getState().startEditing('x')
    expect(store.getState()).toMatchObject({ editingNodeId: 'x', tool: 'select' })
  })

  it('stopEditing(id) ignores a stale id (editing already moved to another node)', () => {
    store.getState().startEditing('b')
    store.getState().stopEditing('a')
    expect(store.getState().editingNodeId).toBe('b')
    store.getState().stopEditing('b')
    expect(store.getState().editingNodeId).toBeNull()
  })

  it('toggles the minimap and respects the initial option', () => {
    expect(createCanvasStore({ minimapVisible: false }).getState().minimapVisible).toBe(false)
    store.getState().toggleMinimap()
    expect(store.getState().minimapVisible).toBe(false)
  })

  it('creates independent stores (no state leaks between editors)', () => {
    const other = createCanvasStore()
    store.getState().addNode(createStickyNote({ x: 0, y: 0 }, 1))
    expect(other.getState().nodes).toHaveLength(0)
  })
})
