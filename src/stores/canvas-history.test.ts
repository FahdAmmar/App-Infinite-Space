import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createGroup, createStickyNote } from '@/features/canvas/utils/node-factory'
import {
  CREATE_MERGE_MS,
  CanvasHistory,
  HISTORY_LIMIT,
  MOVE_COALESCE_MS,
  classifyChange,
  type CanvasSnapshot,
} from './canvas-history'
import { createCanvasStore, type CanvasStoreApi } from './canvas-store'

const sticky = (id: string, x = 0, y = 0) => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y } })
const snap = (nodes: CanvasNode[] = []): CanvasSnapshot => ({ nodes, edges: [] })
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe('CanvasHistory', () => {
  it('undoes and redoes in order and reports availability', () => {
    const h = new CanvasHistory()
    h.record(snap(), 'edit', 0)
    expect([h.canUndo, h.canRedo]).toEqual([true, false])
    const a = snap([sticky('a')])
    expect(h.undo(a, 1)).toEqual(snap())
    expect([h.canUndo, h.canRedo]).toEqual([false, true])
    expect(h.redo(snap(), 2)).toBe(a)
  })

  it('returns null when there is nothing to undo or redo', () => {
    const h = new CanvasHistory()
    expect(h.undo(snap(), 0)).toBeNull()
    expect(h.redo(snap(), 0)).toBeNull()
  })

  it('a new change discards the redo branch', () => {
    const h = new CanvasHistory()
    h.record(snap(), 'edit', 0)
    h.undo(snap([sticky('a')]), 1)
    expect(h.canRedo).toBe(true)
    h.record(snap(), 'edit', 2)
    expect(h.canRedo).toBe(false)
  })

  it('keeps at most the configured number of steps (oldest dropped)', () => {
    const h = new CanvasHistory(3)
    for (let i = 0; i < 5; i += 1) h.record(snap(), 'edit', i * 1000)
    expect(h.undoDepth).toBe(3)
    expect(HISTORY_LIMIT).toBe(100)
  })

  it('merges quick consecutive moves into one step but not slow ones or other kinds', () => {
    const h = new CanvasHistory()
    h.record(snap(), 'move', 0)
    h.record(snap(), 'move', MOVE_COALESCE_MS - 1) // سلسلة سريعة: تُدمج
    expect(h.undoDepth).toBe(1)
    h.record(snap(), 'move', MOVE_COALESCE_MS * 3) // بعد توقف: خطوة جديدة
    expect(h.undoDepth).toBe(2)
    h.record(snap(), 'edit', MOVE_COALESCE_MS * 3 + 1) // نوع مختلف: خطوة جديدة
    expect(h.undoDepth).toBe(3)
  })
})

describe('classifyChange', () => {
  it('is "move" when only positions differ', () => {
    const a = sticky('a', 0, 0)
    expect(classifyChange(snap([a]), snap([{ ...a, position: { x: 5, y: 5 } }])).kind).toBe('move')
  })

  it('is "create" when exactly one node was added and nothing else changed', () => {
    const a = sticky('a')
    expect(classifyChange(snap([a]), snap([a, sticky('b')]))).toEqual({ kind: 'create', nodeId: 'b' })
    expect(classifyChange(snap([a]), snap([a, sticky('b'), sticky('c')])).kind).toBe('edit')
    expect(classifyChange(snap([a]), snap([{ ...a, position: { x: 9, y: 9 } }, sticky('b')])).kind).toBe('edit')
  })

  it('is "content" when exactly one node data changed and nothing else', () => {
    const a = sticky('a')
    const b = sticky('b')
    expect(classifyChange(snap([a, b]), snap([{ ...a, data: { ...a.data, title: 'x' } }, b]))).toEqual({ kind: 'content', nodeId: 'a' })
    expect(classifyChange(snap([a, b]), snap([{ ...a, data: { ...a.data } }, { ...b, data: { ...b.data } }])).kind).toBe('edit')
    expect(classifyChange(snap([a]), snap([{ ...a, data: { ...a.data }, position: { x: 3, y: 3 } }])).kind).toBe('edit')
  })

  it('is "edit" for size, parent and removals', () => {
    const a = sticky('a')
    expect(classifyChange(snap([a]), snap([{ ...a, width: 999 }])).kind).toBe('edit')
    expect(classifyChange(snap([a]), snap([{ ...a, parentId: 'g' }])).kind).toBe('edit')
    expect(classifyChange(snap([a]), snap([])).kind).toBe('edit')
  })
})

describe('creation merges with the first edit of the same node', () => {
  it('merges create + content for the same node within the window', () => {
    const h = new CanvasHistory()
    h.record(snap(), { kind: 'create', nodeId: 'a' }, 0)
    h.record(snap(), { kind: 'content', nodeId: 'a' }, 5_000)
    expect(h.undoDepth).toBe(1)
    h.record(snap(), { kind: 'content', nodeId: 'a' }, 6_000) // التعديل الثاني خطوة مستقلة
    expect(h.undoDepth).toBe(2)
  })

  it('does not merge for another node, after the window, or for a later edit', () => {
    const h = new CanvasHistory()
    h.record(snap(), { kind: 'create', nodeId: 'a' }, 0)
    h.record(snap(), { kind: 'content', nodeId: 'b' }, 1_000)
    expect(h.undoDepth).toBe(2)
    h.record(snap(), { kind: 'create', nodeId: 'c' }, 2_000)
    h.record(snap(), { kind: 'content', nodeId: 'c' }, 2_000 + CREATE_MERGE_MS + 1)
    expect(h.undoDepth).toBe(4)
    h.record(snap(), { kind: 'content', nodeId: 'c' }, 2_000 + CREATE_MERGE_MS + 2)
    expect(h.undoDepth).toBe(5) // الخطوة السابقة 'content' لا تُدمج فيها تعديلات لاحقة
  })
})

describe('canvas store history', () => {
  let store: CanvasStoreApi
  const nodes = () => store.getState().nodes
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    store = createCanvasStore()
  })
  afterEach(() => vi.useRealTimers())

  it('undoes and redoes adding a node', () => {
    store.getState().addNode(sticky('a'))
    expect(store.getState().undo()).toBe(true)
    expect(nodes()).toHaveLength(0)
    expect(store.getState().redo()).toBe(true)
    expect(nodes().map((n) => n.id)).toEqual(['a'])
  })

  it('does not record selection changes', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().clearSelection()
    store.getState().selectAll()
    store.getState().applyNodeChanges([{ type: 'select', id: 'a', selected: false }])
    store.getState().undo() // يتراجع عن الإضافة فقط، لا عن التحديد
    expect(nodes()).toHaveLength(0)
    expect(store.getState().undo()).toBe(false)
  })

  it('treats a multi-step action as one undo step (delete node and its edges)', async () => {
    store.getState().addNodes([sticky('a'), sticky('b', 400, 0)])
    store.getState().connectNodes({ source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })
    await flush()
    store.getState().clearSelection()
    store.getState().applyNodeChanges([{ type: 'select', id: 'a', selected: true }])
    store.getState().removeSelection()
    expect([nodes().length, store.getState().edges.length]).toEqual([1, 0])
    store.getState().undo()
    expect([nodes().length, store.getState().edges.length]).toEqual([2, 1])
  })

  it('a drag wrapped in a transaction is one step, however many moves it contains', async () => {
    store.getState().addNode(sticky('a', 10, 10))
    await flush()
    store.getState().beginTransaction()
    for (let i = 1; i <= 30; i += 1) {
      store.getState().applyNodeChanges([{ type: 'position', id: 'a', position: { x: 10 + i * 5, y: 10 }, dragging: true }])
    }
    store.getState().endTransaction()
    expect(nodes()[0]?.position).toEqual({ x: 160, y: 10 })
    store.getState().undo()
    expect(nodes()[0]?.position).toEqual({ x: 10, y: 10 })
    expect(nodes()).toHaveLength(1) // ما زالت العقدة موجودة: تراجعنا عن الحركة لا عن الإضافة
  })

  it('an empty transaction records nothing', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().undo()
    store.getState().redo()
    store.getState().beginTransaction()
    store.getState().endTransaction()
    store.getState().undo()
    expect(nodes()).toHaveLength(0) // هذه كانت خطوة الإضافة وليست خطوة فارغة
    expect(store.getState().undo()).toBe(false)
  })

  it('merges quick keyboard-style moves outside a transaction, splits slow ones', async () => {
    store.getState().addNode(sticky('a', 0, 0))
    await flush()
    // كل حركة حدث مستقل (دورة حدث منفصلة) كضغطات الأسهم؛ الحركات المتزامنة داخل دورة واحدة خطوة واحدة أصلاً
    const move = async (x: number) => {
      store.getState().applyNodeChanges([{ type: 'position', id: 'a', position: { x, y: 0 } }])
      await flush()
    }
    await move(10)
    vi.advanceTimersByTime(100)
    await move(20)
    vi.advanceTimersByTime(100)
    await move(30)
    vi.advanceTimersByTime(MOVE_COALESCE_MS * 2)
    await move(40)
    store.getState().undo() // يتراجع عن الحركة المنفردة 30→40
    expect(nodes()[0]?.position.x).toBe(30)
    store.getState().undo() // يتراجع عن السلسلة السريعة 0→30
    expect(nodes()[0]?.position.x).toBe(0)
  })

  it('actions in the same event-loop turn form a single step', () => {
    store.getState().addNode(sticky('a'))
    store.getState().addNode(sticky('b'))
    store.getState().undo()
    expect(nodes()).toHaveLength(0)
  })

  it('a new edit after undo clears redo', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().undo()
    expect(store.getState().canRedo).toBe(true)
    store.getState().addNode(sticky('b'))
    await flush()
    expect(store.getState().redo()).toBe(false)
  })

  it('exposes canUndo/canRedo flags for the UI', async () => {
    expect([store.getState().canUndo, store.getState().canRedo]).toEqual([false, false])
    store.getState().addNode(sticky('a'))
    await flush()
    expect([store.getState().canUndo, store.getState().canRedo]).toEqual([true, false])
    store.getState().undo()
    expect([store.getState().canUndo, store.getState().canRedo]).toEqual([false, true])
  })

  it('restores group membership and relative positions', async () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 100, y: 100 } }
    store.getState().addNodes([group, sticky('m', 150, 150)])
    await flush()
    expect(nodes().find((n) => n.id === 'm')?.parentId).toBe('g')
    store.getState().removeNodes(['g']) // يطلق العضو
    expect(nodes().find((n) => n.id === 'm')?.parentId).toBeUndefined()
    store.getState().undo()
    const member = nodes().find((n) => n.id === 'm')
    expect(member?.parentId).toBe('g')
    expect(member?.position).toEqual({ x: 50, y: 50 })
  })

  it('undo clears selection, editing and a pending connect source', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().startEditing('a')
    store.getState().setConnectSource('a')
    store.getState().undo()
    expect(store.getState().editingNodeId).toBeNull()
    store.getState().redo()
    expect(nodes().every((n) => !n.selected)).toBe(true)
  })

  it('creating a note and typing into it is a single undo step', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().updateStickyNote('a', { content: 'first text' })
    await flush()
    store.getState().undo()
    expect(nodes()).toHaveLength(0) // الورقة كلها زالت بخطوة واحدة
    store.getState().redo()
    const note = nodes()[0]
    expect(note?.type === 'sticky' && note.data.content).toBe('first text')
  })

  it('a second edit of the same note is its own step', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().updateStickyNote('a', { content: 'one' })
    await flush()
    store.getState().updateStickyNote('a', { content: 'two' })
    await flush()
    store.getState().undo()
    const note = nodes()[0]
    expect(note?.type === 'sticky' && note.data.content).toBe('one')
  })

  it('records a later text edit as one step of its own', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    store.getState().updateStickyNote('a', { content: 'first' })
    await flush()
    store.getState().updateStickyNote('a', { title: 'Hello', content: 'World' })
    store.getState().undo()
    const note = nodes()[0]
    expect(note?.type === 'sticky' && [note.data.title, note.data.content]).toEqual(['', 'first'])
  })

  it('keeps no more than the history limit', async () => {
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      store.getState().addNode(sticky(`n${i}`))
      await flush()
    }
    let undone = 0
    while (store.getState().undo()) undone += 1
    expect(undone).toBe(HISTORY_LIMIT)
  })
})
