import type { NodeChange } from '@xyflow/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createGroup, createStickyNote, createTextCard } from '@/features/canvas/utils/node-factory'
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

describe('reconnectEdge', () => {
  const setup = () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 400, y: 0 }, 1)
    const c = createStickyNote({ x: 800, y: 0 }, 1)
    store.getState().addNodes([a, b, c])
    const connected = store.getState().connectNodes({ source: a.id, target: b.id, sourceHandle: 'right', targetHandle: 'left' })
    if (!connected.ok) throw new Error('setup failed')
    store.getState().updateEdge(connected.edgeId, { label: 'keeps me', lineStyle: 'dashed' })
    return { a, b, c, edgeId: connected.edgeId }
  }
  const edge = (id: string) => store.getState().edges.find((e) => e.id === id)

  it('moves the end to another card and keeps the style and label', () => {
    const { a, c, edgeId } = setup()
    expect(store.getState().reconnectEdge(edgeId, { source: a.id, target: c.id, sourceHandle: 'right', targetHandle: 'top' })).toEqual({
      ok: true,
      edgeId,
    })
    expect(edge(edgeId)).toMatchObject({ source: a.id, target: c.id, targetHandle: 'top', selected: true })
    expect(edge(edgeId)?.data).toMatchObject({ label: 'keeps me', lineStyle: 'dashed' })
    expect(store.getState().edges).toHaveLength(1)
  })

  it('lets an end move to another side of the same card (the edge is not its own duplicate)', () => {
    const { a, b, edgeId } = setup()
    const result = store.getState().reconnectEdge(edgeId, { source: a.id, target: b.id, sourceHandle: 'bottom', targetHandle: 'bottom' })
    expect(result.ok).toBe(true)
    expect(edge(edgeId)).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'bottom' })
  })

  it('refuses a move that would duplicate another connection, and changes nothing', () => {
    const { a, b, c, edgeId } = setup()
    const second = store.getState().connectNodes({ source: a.id, target: c.id, sourceHandle: 'right', targetHandle: 'left' })
    expect(second.ok).toBe(true)
    const before = edge(edgeId)
    const result = store.getState().reconnectEdge(edgeId, { source: a.id, target: c.id, sourceHandle: 'right', targetHandle: 'left' })
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('already connected') })
    expect(edge(edgeId)).toBe(before)
    expect(b.id).toBeTruthy()
  })

  it.each([
    ['onto itself', (a: string) => ({ source: a, target: a })],
    ['to nothing', () => ({ source: null, target: null })],
  ])('refuses a move %s', (_label, make) => {
    const { a, edgeId } = setup()
    const connection = { sourceHandle: null, targetHandle: null, ...make(a.id) } as Parameters<ReturnType<typeof store.getState>['reconnectEdge']>[1]
    expect(store.getState().reconnectEdge(edgeId, connection).ok).toBe(false)
  })

  it('refuses a group as an end', () => {
    const { a, edgeId } = setup()
    const group = createGroup({ x: 0, y: 400 }, 1)
    store.getState().addNode(group)
    expect(store.getState().reconnectEdge(edgeId, { source: a.id, target: group.id, sourceHandle: null, targetHandle: null }).ok).toBe(false)
  })

  it('reports a connection that no longer exists', () => {
    const { a, b } = setup()
    expect(store.getState().reconnectEdge('gone', { source: a.id, target: b.id, sourceHandle: null, targetHandle: null })).toMatchObject({ ok: false })
  })

  it('keeps the old handles when the new connection names an unknown side', () => {
    const { a, c, edgeId } = setup()
    store.getState().reconnectEdge(edgeId, { source: a.id, target: c.id, sourceHandle: 'weird', targetHandle: null })
    expect(edge(edgeId)).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
  })
})

describe('pasteItems', () => {
  const pasted = () => ({
    nodes: [
      { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'p1', position: { x: 10, y: 10 } },
      { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'p2', position: { x: 400, y: 10 } },
    ],
    edges: [
      {
        id: 'pe',
        type: 'connection',
        source: 'p1',
        target: 'p2',
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { curve: 'curved', lineStyle: 'solid', arrow: 'end', color: 'gradient', label: '' },
      },
    ] as CanvasEdge[],
  })

  it('adds the cards and their connection, selects only the new cards', () => {
    const existing = createStickyNote({ x: 900, y: 0 }, 1)
    store.getState().addNode(existing)
    const ids = store.getState().pasteItems(pasted())
    expect(ids).toEqual(['p1', 'p2'])
    expect(selectSelectedIds(store.getState()).sort()).toEqual(['p1', 'p2'])
    expect(byId(existing.id)?.selected).toBe(false)
    expect(store.getState().edges.map((e) => e.id)).toEqual(['pe'])
  })

  it('is one undo step', () => {
    store.getState().pasteItems(pasted())
    store.getState().undo()
    expect(nodes()).toHaveLength(0)
    expect(store.getState().edges).toHaveLength(0)
  })

  it('adds nothing when the canvas has no room for the cards', () => {
    const small = createCanvasStore({ limits: { maxNodes: 1, maxEdges: 10 } })
    expect(small.getState().pasteItems(pasted())).toEqual([])
    expect(small.getState().nodes).toHaveLength(0)
  })

  it('adds nothing when there is no room for the connections', () => {
    const tight = createCanvasStore({ limits: { maxNodes: 10, maxEdges: 0 } })
    expect(tight.getState().pasteItems(pasted())).toEqual([])
  })

  it('ignores an empty paste', () => {
    expect(store.getState().pasteItems({ nodes: [], edges: [] })).toEqual([])
  })

  it('a pasted card that lands inside an existing group joins it', () => {
    const frame = { ...createGroup({ x: 0, y: 0 }, 1), id: 'frame', position: { x: 0, y: 0 } }
    store.getState().addNode(frame)
    const card = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'in', position: { x: 40, y: 80 } }
    store.getState().pasteItems({ nodes: [card], edges: [] })
    expect(byId('in')?.parentId).toBe('frame')
  })
})

describe('undo of reconnectEdge', () => {
  it('restores the previous end in one step', async () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 400, y: 0 }, 1)
    const c = createStickyNote({ x: 800, y: 0 }, 1)
    store.getState().addNodes([a, b, c])
    const made = store.getState().connectNodes({ source: a.id, target: b.id, sourceHandle: 'right', targetHandle: 'left' })
    if (!made.ok) throw new Error('setup')
    // التاريخ يجمع التعديلات المتزامنة في خطوة واحدة؛ ننتظر كي تكون إعادة التوصيل خطوتها الخاصة
    await Promise.resolve()
    store.getState().reconnectEdge(made.edgeId, { source: a.id, target: c.id, sourceHandle: 'right', targetHandle: 'left' })
    store.getState().undo()
    expect(store.getState().edges.find((e) => e.id === made.edgeId)?.target).toBe(b.id)
  })
})

describe('moveNodes', () => {
  it('moves several cards in one undo step', async () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 500, y: 0 }, 1)
    store.getState().addNodes([a, b])
    await Promise.resolve()
    store.getState().moveNodes([
      { id: a.id, position: { x: 10, y: 20 } },
      { id: b.id, position: { x: 30, y: 40 } },
    ])
    expect(byId(a.id)?.position).toEqual({ x: 10, y: 20 })
    expect(byId(b.id)?.position).toEqual({ x: 30, y: 40 })
    store.getState().undo()
    expect(byId(a.id)?.position).toEqual(a.position)
    expect(byId(b.id)?.position).toEqual(b.position)
  })

  it('does nothing for an empty list and ignores unknown ids', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    const before = nodes()
    store.getState().moveNodes([])
    expect(nodes()).toBe(before)
    store.getState().moveNodes([{ id: 'ghost', position: { x: 1, y: 1 } }])
    expect(byId(a.id)?.position).toEqual(a.position)
  })

  it('re-evaluates group membership after moving', () => {
    const frame = { ...createGroup({ x: 0, y: 0 }, 1), id: 'frame', position: { x: 0, y: 0 } }
    const card = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'c', position: { x: 2000, y: 2000 } }
    store.getState().addNodes([frame, card])
    expect(byId('c')?.parentId).toBeUndefined()
    store.getState().moveNodes([{ id: 'c', position: { x: 40, y: 80 } }])
    expect(byId('c')?.parentId).toBe('frame')
  })
})

describe('reorderLayers', () => {
  it('changes the drawing order, is one undo step, and survives a save and load', async () => {
    const { serializeCanvas, deserializeCanvas } = await import('@/features/canvas/persistence/canvas-codec')
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 100, y: 0 }, 1)
    const c = createStickyNote({ x: 200, y: 0 }, 1)
    store.getState().addNodes([a, b, c])
    await Promise.resolve()
    store.getState().reorderLayers([a.id], 'front')
    expect(nodes().map((n) => n.id)).toEqual([b.id, c.id, a.id])

    const reloaded = deserializeCanvas(serializeCanvas(nodes(), store.getState().edges, { x: 0, y: 0, zoom: 1 }), 1)
    expect(reloaded.nodes.map((n) => n.id)).toEqual([b.id, c.id, a.id])

    store.getState().undo()
    expect(nodes().map((n) => n.id)).toEqual([a.id, b.id, c.id])
  })

  it('does nothing (and records nothing) when the order would not change', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    const before = nodes()
    store.getState().reorderLayers([a.id], 'front')
    expect(nodes()).toBe(before)
  })
})

describe('card status and lock', () => {
  it('cycles a card status and records one undo step per change', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().cycleNodeStatus(a.id)
    expect(byId(a.id)?.data.status).toBe('doing')
    store.getState().cycleNodeStatus(a.id)
    expect(byId(a.id)?.data.status).toBe('done')
    store.getState().cycleNodeStatus(a.id)
    expect(byId(a.id)?.data.status).toBeUndefined()
  })

  it('does nothing (same node references) when the status is already set', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().setNodesStatus([a.id], 'done')
    const before = nodes()
    store.getState().setNodesStatus([a.id], 'done')
    expect(nodes()).toBe(before)
  })

  it('ignores groups when setting status', () => {
    const group = createGroup({ x: 0, y: 0 }, 1)
    store.getState().addNode(group)
    store.getState().cycleNodeStatus(group.id)
    store.getState().setNodesStatus([group.id], 'done')
    expect(byId(group.id)?.data.status).toBeUndefined()
  })

  it('a locked card is not removed, moved or resized, but an unlocked one still is', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 400, y: 0 }, 1)
    store.getState().addNodes([a, b])
    store.getState().setNodesLocked([a.id], true)
    const width = byId(a.id)?.width

    store.getState().moveNodes([{ id: a.id, position: { x: 999, y: 999 } }, { id: b.id, position: { x: 500, y: 500 } }])
    expect(byId(a.id)?.position).toEqual(a.position)
    expect(byId(b.id)?.position).toEqual({ x: 500, y: 500 })

    store.getState().resizeNode(a.id, { width: 300 })
    expect(byId(a.id)?.width).toBe(width)

    store.getState().removeNodes([a.id, b.id])
    expect(byId(a.id)).toBeDefined()
    expect(byId(b.id)).toBeUndefined()
  })

  it('removeSelection keeps locked cards and removeNodes of only locked cards changes nothing', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().setNodesLocked([a.id], true)
    const before = nodes()
    store.getState().selectAll()
    store.getState().removeSelection()
    expect(nodes().map((n) => n.id)).toEqual(before.map((n) => n.id))
  })

  it('unlocking restores movement and deletion', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().setNodesLocked([a.id], true)
    store.getState().setNodesLocked([a.id], false)
    store.getState().moveNodes([{ id: a.id, position: { x: 50, y: 60 } }])
    expect(byId(a.id)?.position).toEqual({ x: 50, y: 60 })
    expect(byId(a.id)?.draggable).toBeUndefined()
    store.getState().removeNodes([a.id])
    expect(byId(a.id)).toBeUndefined()
  })

  it('lock and status changes can be undone and redone', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    store.getState().addNode(a)
    store.getState().setNodesLocked([a.id], true)
    expect(store.getState().undo()).toBe(true)
    expect(byId(a.id)?.data.locked).toBeUndefined()
    expect(byId(a.id)?.draggable).toBeUndefined()
    expect(store.getState().redo()).toBe(true)
    expect(byId(a.id)?.data.locked).toBe(true)
    expect(byId(a.id)?.draggable).toBe(false)
  })
})
