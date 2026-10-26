import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createEdge } from '@/features/canvas/utils/edge-utils'
import { createGroup, createLinkCard, createStickyNote, createTextCard } from '@/features/canvas/utils/node-factory'
import { LIMIT_REACHED, createCanvasStore, type CanvasStoreApi } from './canvas-store'
import { selectSelectedEdgeIds } from './canvas-selectors'

let store: CanvasStoreApi
const nodes = () => store.getState().nodes
const edges = () => store.getState().edges
const byId = (id: string): CanvasNode | undefined => nodes().find((n) => n.id === id)

const sticky = (id: string, x: number, y: number) => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y } })
const group = (id: string, x: number, y: number, width = 700, height = 500) => ({
  ...createGroup({ x: 0, y: 0 }, 1),
  id,
  position: { x, y },
  width,
  height,
})

beforeEach(() => {
  store = createCanvasStore()
})

describe('connectNodes', () => {
  beforeEach(() => {
    store.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0)])
  })

  it('creates a selected edge with the chosen handles and deselects the nodes', () => {
    const result = store.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })
    expect(result.ok).toBe(true)
    expect(edges()).toHaveLength(1)
    expect(edges()[0]).toMatchObject({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', selected: true })
    expect(nodes().every((n) => !n.selected)).toBe(true)
    expect(selectSelectedEdgeIds(store.getState())).toHaveLength(1)
  })

  it('refuses self, duplicate and group connections with a readable reason', () => {
    store.getState().addNode(group('g', 1000, 0))
    const self = store.getState().connectNodes({ source: 'a', target: 'a', sourceHandle: null, targetHandle: null })
    expect(self).toMatchObject({ ok: false })
    store.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null })
    const duplicate = store.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null })
    expect(duplicate).toMatchObject({ ok: false })
    const toGroup = store.getState().connectNodes({ source: 'a', target: 'g', sourceHandle: null, targetHandle: null })
    expect(toGroup.ok === false && toGroup.reason).toMatch(/group/i)
    expect(edges()).toHaveLength(1)
  })
})

describe('clickConnect (the Connect tool)', () => {
  beforeEach(() => {
    store.getState().addNodes([sticky('a', 0, 0), sticky('b', 600, 0), group('g', 0, 600)])
    store.getState().setTool('connect')
  })

  it('first click picks the source, second click connects and returns to the select tool', () => {
    expect(store.getState().clickConnect('a')).toEqual({ status: 'picked' })
    expect(store.getState().connectSource).toBe('a')
    const result = store.getState().clickConnect('b')
    expect(result.status).toBe('connected')
    expect(edges()[0]).toMatchObject({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })
    expect(store.getState().tool).toBe('select')
    expect(store.getState().connectSource).toBeNull()
  })

  it('clicking the source again cancels the pick', () => {
    store.getState().clickConnect('a')
    expect(store.getState().clickConnect('a')).toEqual({ status: 'cleared' })
    expect(store.getState().connectSource).toBeNull()
  })

  it('rejects groups and keeps the pending source on a rejected target', () => {
    expect(store.getState().clickConnect('g').status).toBe('rejected')
    store.getState().clickConnect('a')
    store.getState().clickConnect('b')
    store.getState().setTool('connect')
    store.getState().clickConnect('a')
    const again = store.getState().clickConnect('b')
    expect(again.status).toBe('rejected')
    expect(store.getState().connectSource).toBe('a')
    expect(edges()).toHaveLength(1)
  })

  it('leaving the connect tool drops the pending source', () => {
    store.getState().clickConnect('a')
    store.getState().setTool('select')
    expect(store.getState().connectSource).toBeNull()
  })
})

describe('removing nodes and edges', () => {
  beforeEach(() => {
    store.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0), sticky('c', 800, 0)])
    store.setState({
      edges: [createEdge('a', 'b', 'right', 'left'), createEdge('b', 'c', 'right', 'left')],
    })
  })

  it('removeNodes also removes the edges attached to the removed nodes', () => {
    store.getState().removeNodes(['b'])
    expect(edges()).toHaveLength(0)
  })

  it('keeps edges between surviving nodes', () => {
    store.getState().removeNodes(['c'])
    expect(edges()).toHaveLength(1)
    expect(edges()[0]?.target).toBe('b')
  })

  it('applyNodeChanges(remove) cleans up edges too (e.g. removal initiated by React Flow)', () => {
    store.getState().applyNodeChanges([{ type: 'remove', id: 'a' }])
    expect(edges().map((e) => e.target)).toEqual(['c'])
  })

  it('removeSelection removes selected nodes and selected edges together', () => {
    store.getState().clearSelection()
    const edgeId = edges()[1]?.id ?? ''
    store.getState().applyEdgeChanges([{ type: 'select', id: edgeId, selected: true }])
    store.getState().applyNodeChanges([{ type: 'select', id: 'a', selected: true }])
    store.getState().removeSelection()
    expect(nodes().map((n) => n.id)).toEqual(['b', 'c'])
    expect(edges()).toHaveLength(0) // الأولى حُذفت مع a، والثانية لأنها محددة
  })

  it('removeEdges removes only the given edges', () => {
    const [first, second] = edges()
    store.getState().removeEdges([first?.id ?? ''])
    expect(edges().map((e) => e.id)).toEqual([second?.id])
  })
})

describe('updateEdge', () => {
  it('merges the style patch into the edge data', () => {
    store.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0)])
    store.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })
    const id = edges()[0]?.id ?? ''
    store.getState().updateEdge(id, { label: 'leads to', arrow: 'both', color: 'pink' })
    expect(edges()[0]?.data).toMatchObject({ label: 'leads to', arrow: 'both', color: 'pink', curve: 'curved', lineStyle: 'solid' })
  })
})

describe('groups in the store', () => {
  it('adding a node on top of a group makes it a member immediately', () => {
    store.getState().addNode(group('g', 0, 0))
    store.getState().addNode(sticky('a', 100, 100))
    expect(byId('a')?.parentId).toBe('g')
    expect(byId('a')?.position).toEqual({ x: 100, y: 100 })
  })

  it('keeps groups ahead of other nodes in the array (React Flow needs parents first)', () => {
    store.getState().addNode(sticky('a', 5000, 5000))
    store.getState().addNode(group('g', 0, 0))
    expect(nodes().map((n) => n.id)).toEqual(['g', 'a'])
  })

  it('reconcileMembership after a drag attaches and detaches', () => {
    store.getState().addNodes([group('g', 0, 0), sticky('a', 3000, 3000)])
    store.getState().applyNodeChanges([{ type: 'position', id: 'a', position: { x: 100, y: 100 } }])
    store.getState().reconcileMembership(['a'])
    expect(byId('a')?.parentId).toBe('g')
    store.getState().applyNodeChanges([{ type: 'position', id: 'a', position: { x: 2000, y: 2000 } }])
    store.getState().reconcileMembership(['a'])
    expect(byId('a')?.parentId).toBeUndefined()
    expect(byId('a')?.position).toEqual({ x: 2000, y: 2000 })
  })

  it('deleting a group keeps its members, at the same place on the canvas', () => {
    store.getState().addNodes([group('g', 100, 100), sticky('m', 150, 150)])
    expect(byId('m')?.parentId).toBe('g')
    store.getState().removeNodes(['g'])
    expect(byId('g')).toBeUndefined()
    expect(byId('m')?.parentId).toBeUndefined()
    expect(byId('m')?.position).toEqual({ x: 150, y: 150 })
  })

  it('deleting a group together with its members removes them all', () => {
    store.getState().addNodes([group('g', 100, 100), sticky('m', 150, 150)])
    store.getState().removeNodes(['g', 'm'])
    expect(nodes()).toHaveLength(0)
  })

  it('a React Flow remove change on a group also releases members instead of orphaning them', () => {
    store.getState().addNodes([group('g', 100, 100), sticky('m', 150, 150)])
    store.getState().applyNodeChanges([{ type: 'remove', id: 'g' }])
    expect(byId('m')?.parentId).toBeUndefined()
  })

  it('reconcileAllMembership captures what a grown group now covers', () => {
    store.getState().addNodes([group('g', 0, 0, 300, 200), sticky('a', 400, 50)])
    expect(byId('a')?.parentId).toBeUndefined()
    store.getState().resizeNode('g', { width: 900, height: 500 })
    store.getState().reconcileAllMembership()
    expect(byId('a')?.parentId).toBe('g')
  })

  it('duplicating a group duplicates members and the edges between them', () => {
    store.getState().addNodes([group('g', 0, 0), sticky('m1', 50, 50), sticky('m2', 300, 50)])
    store.getState().connectNodes({ source: 'm1', target: 'm2', sourceHandle: 'right', targetHandle: 'left' })
    store.getState().clearSelection()
    store.getState().applyNodeChanges([{ type: 'select', id: 'g', selected: true }])
    const ids = store.getState().duplicateSelected()
    expect(ids).toHaveLength(3)
    expect(nodes()).toHaveLength(6)
    expect(edges()).toHaveLength(2)
    const copiedEdge = edges().find((e) => ids.includes(e.source))
    expect(copiedEdge && ids.includes(copiedEdge.target)).toBe(true)
  })
})

describe('updateNodeData / resizeNode', () => {
  it('updates link and group data, and ignores a patch aimed at another type', () => {
    const link = { ...createLinkCard({ x: 0, y: 0 }, 1), id: 'l' }
    store.getState().addNodes([link, group('g', 3000, 3000)])
    store.getState().updateNodeData('l', 'link', { url: 'https://example.com/', title: 'Example' })
    store.getState().updateNodeData('g', 'group', { label: 'Research', color: 'blue' })
    store.getState().updateNodeData('l', 'group', { label: 'wrong type' })
    const updatedLink = byId('l')
    const updatedGroup = byId('g')
    expect(updatedLink?.type === 'link' && updatedLink.data).toMatchObject({ url: 'https://example.com/', title: 'Example' })
    expect(updatedGroup?.type === 'group' && updatedGroup.data).toMatchObject({ label: 'Research', color: 'blue' })
    expect(updatedLink?.type === 'link' && 'label' in updatedLink.data).toBe(false)
  })

  it('clamps sizes to the limits of each type and never sets a height on images', () => {
    store.getState().addNodes([{ ...createTextCard({ x: 0, y: 0 }, 1), id: 't' }])
    store.getState().resizeNode('t', { width: 10, height: 99999 })
    expect(byId('t')).toMatchObject({ width: 240, height: 4000 })
  })
})

describe('canvas size limits', () => {
  const small = () => createCanvasStore({ limits: { maxNodes: 3, maxEdges: 1 } })

  it('canAdd reports whether more nodes and edges fit', () => {
    const limited = small()
    expect(limited.getState().canAdd(3)).toBe(true)
    expect(limited.getState().canAdd(4)).toBe(false)
    limited.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0)])
    expect(limited.getState().canAdd(1)).toBe(true)
    expect(limited.getState().canAdd(2)).toBe(false)
    expect(limited.getState().canAdd(0, 2)).toBe(false)
  })

  it('refuses to add nodes beyond the limit and leaves the canvas untouched', () => {
    const limited = small()
    limited.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0), sticky('c', 800, 0)])
    const before = limited.getState().nodes
    limited.getState().addNode(sticky('d', 1200, 0))
    expect(limited.getState().nodes).toBe(before)
  })

  it('refuses to duplicate when the copies would not fit (nothing is partially copied)', () => {
    const limited = small()
    limited.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0)])
    limited.getState().selectAll()
    expect(limited.getState().duplicateSelected()).toEqual([])
    expect(limited.getState().nodes).toHaveLength(2)
    limited.getState().clearSelection()
    limited.getState().applyNodeChanges([{ type: 'select', id: 'a', selected: true }])
    expect(limited.getState().duplicateSelected()).toHaveLength(1)
    expect(limited.getState().nodes).toHaveLength(3)
  })

  it('refuses a connection beyond the edge limit with the shared message', () => {
    const limited = createCanvasStore({ limits: { maxNodes: 10, maxEdges: 1 } })
    limited.getState().addNodes([sticky('a', 0, 0), sticky('b', 400, 0), sticky('c', 800, 0)])
    expect(limited.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' }).ok).toBe(true)
    const second = limited.getState().connectNodes({ source: 'b', target: 'c', sourceHandle: 'right', targetHandle: 'left' })
    expect(second).toEqual({ ok: false, reason: LIMIT_REACHED })
    limited.getState().setTool('connect')
    limited.getState().clickConnect('b')
    expect(limited.getState().clickConnect('c')).toEqual({ status: 'rejected', reason: LIMIT_REACHED })
    expect(limited.getState().edges).toHaveLength(1)
  })

  it('the message names the real limit', () => {
    expect(LIMIT_REACHED).toContain('5,000')
  })
})
