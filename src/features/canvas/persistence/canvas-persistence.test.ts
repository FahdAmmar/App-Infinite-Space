import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageError, type StoredCanvas } from '@/services/persistence/storage-adapter'
import { createCanvasStore, type CanvasStoreApi } from '@/stores/canvas-store'
import { createStickyNote } from '../utils/node-factory'
import { SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS, createCanvasPersistence } from './canvas-persistence'

const sticky = (id: string, x = 0, y = 0) => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y } })
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

class FakeStorage {
  saves: StoredCanvas[] = []
  fail: Error | null = null
  /** إن وُضع، يتأخر كل حفظ حتى يُستدعى release (لمحاكاة كتابة بطيئة) */
  gate: Promise<void> | null = null
  async saveCanvas(_id: string, canvas: StoredCanvas): Promise<void> {
    if (this.gate) await this.gate
    if (this.fail) throw this.fail
    this.saves.push(canvas)
  }
}

let store: CanvasStoreApi
let storage: FakeStorage
const ids = (canvas: StoredCanvas | undefined) => (canvas?.nodes as { id: string }[] | undefined)?.map((n) => n.id)

beforeEach(() => {
  vi.useFakeTimers()
  store = createCanvasStore()
  storage = new FakeStorage()
})
afterEach(() => vi.useRealTimers())

const setup = (onSaved?: Parameters<typeof createCanvasPersistence>[0]['onSaved']) =>
  createCanvasPersistence({ workspaceId: 'w', store, storage, ...(onSaved ? { onSaved } : {}) })

describe('autosave', () => {
  it('does nothing until something changes', async () => {
    setup()
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS * 2)
    expect(storage.saves).toHaveLength(0)
    expect(store.getState().saveStatus.kind).toBe('saved')
  })

  it('marks the canvas unsaved immediately and writes once after the debounce', async () => {
    setup()
    store.getState().addNode(sticky('a'))
    expect(store.getState().saveStatus.kind).toBe('unsaved')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1)
    expect(storage.saves).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2)
    expect(storage.saves).toHaveLength(1)
    expect(ids(storage.saves[0])).toEqual(['a'])
    expect(store.getState().saveStatus.kind).toBe('saved')
  })

  it('collapses a burst of edits into one write', async () => {
    setup()
    for (let i = 0; i < 20; i += 1) {
      store.getState().addNode(sticky(`n${i}`))
      await vi.advanceTimersByTimeAsync(100)
    }
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(storage.saves.length).toBeLessThanOrEqual(3) // سقف الانتظار الأقصى قد يقسمها لكن ليس كتابة لكل تعديل
    expect(ids(storage.saves.at(-1))).toHaveLength(20)
  })

  it('writes within the maximum wait even if edits never pause', async () => {
    setup()
    for (let elapsed = 0; elapsed < SAVE_MAX_WAIT_MS + 1000; elapsed += 200) {
      store.getState().addNode(sticky(`n${elapsed}`))
      await vi.advanceTimersByTimeAsync(200)
    }
    expect(storage.saves.length).toBeGreaterThanOrEqual(1)
  })

  it('selection and measurement changes do not trigger a save', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    setup()
    store.getState().clearSelection()
    store.getState().selectAll()
    store.getState().applyNodeChanges([{ type: 'dimensions', id: 'a', dimensions: { width: 50, height: 50 } }])
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS)
    expect(storage.saves).toHaveLength(0)
    expect(store.getState().saveStatus.kind).toBe('saved')
  })

  it('saves viewport changes, reported as not a content change', async () => {
    const onSaved = vi.fn()
    setup(onSaved)
    store.getState().setViewport({ x: 40, y: 50, zoom: 2 })
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    expect(storage.saves[0]?.viewport).toEqual({ x: 40, y: 50, zoom: 2 })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ nodeCount: 0 }), false)
  })

  it('reports content changes with a summary for the dashboard card', async () => {
    const onSaved = vi.fn()
    setup(onSaved)
    store.getState().addNodes([sticky('a'), sticky('b', 400, 0)])
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    expect(onSaved).toHaveBeenCalledTimes(1)
    const [summary, contentChanged] = onSaved.mock.calls[0] as [{ nodeCount: number; preview: unknown[] }, boolean]
    expect(contentChanged).toBe(true)
    expect(summary.nodeCount).toBe(2)
    expect(summary.preview).toHaveLength(2)
  })

  it('returning to the saved state by undo cancels the pending write', async () => {
    store.getState().addNode(sticky('a'))
    await flush()
    setup()
    store.getState().addNode(sticky('b'))
    await flush()
    expect(store.getState().saveStatus.kind).toBe('unsaved')
    store.getState().undo()
    expect(store.getState().saveStatus.kind).toBe('saved')
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS)
    expect(storage.saves).toHaveLength(0)
  })
})

describe('flush and lifecycle', () => {
  it('flush writes immediately without waiting for the debounce', async () => {
    const persistence = setup()
    store.getState().addNode(sticky('a'))
    await persistence.flush()
    expect(ids(storage.saves[0])).toEqual(['a'])
  })

  it('flush is harmless when nothing changed', async () => {
    const persistence = setup()
    await persistence.flush()
    expect(storage.saves).toHaveLength(0)
  })

  it('stops watching and scheduling after dispose, but a flush still works', async () => {
    const persistence = setup()
    store.getState().addNode(sticky('a'))
    persistence.dispose()
    await vi.advanceTimersByTimeAsync(SAVE_MAX_WAIT_MS)
    expect(storage.saves).toHaveLength(0)
    await persistence.flush()
    expect(storage.saves).toHaveLength(1)
  })

  it('hasUnsavedChanges reflects dirty and failed states', async () => {
    const persistence = setup()
    expect(persistence.hasUnsavedChanges()).toBe(false)
    store.getState().addNode(sticky('a'))
    expect(persistence.hasUnsavedChanges()).toBe(true)
    await persistence.flush()
    expect(persistence.hasUnsavedChanges()).toBe(false)
  })
})

describe('failures', () => {
  it('shows the error status with the reason and keeps the work in memory', async () => {
    storage.fail = new StorageError('quota', 'full')
    setup()
    store.getState().addNode(sticky('a'))
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    expect(store.getState().saveStatus).toEqual({ kind: 'error', reason: 'quota' })
    expect(store.getState().nodes).toHaveLength(1)
  })

  it('retry succeeds once storage recovers', async () => {
    storage.fail = new StorageError('unavailable', 'blocked')
    const persistence = setup()
    store.getState().addNode(sticky('a'))
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    expect(store.getState().saveStatus.kind).toBe('error')
    expect(persistence.hasUnsavedChanges()).toBe(true)
    storage.fail = null
    await persistence.retry()
    expect(store.getState().saveStatus.kind).toBe('saved')
    expect(ids(storage.saves[0])).toEqual(['a'])
  })

  it('the error status is not hidden by further edits, and the next edit retries automatically', async () => {
    storage.fail = new Error('boom')
    setup()
    store.getState().addNode(sticky('a'))
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    store.getState().addNode(sticky('b'))
    expect(store.getState().saveStatus.kind).toBe('error')
    storage.fail = null
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1)
    expect(ids(storage.saves.at(-1))).toEqual(['a', 'b'])
    expect(store.getState().saveStatus.kind).toBe('saved')
  })
})

describe('ordering and stale writes', () => {
  it('an edit made during a slow save is saved afterwards and the latest state wins', async () => {
    let release: () => void = () => undefined
    storage.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    setup()
    store.getState().addNode(sticky('a'))
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 1) // الحفظ الأول عالق في البوابة
    expect(store.getState().saveStatus.kind).toBe('saving')
    store.getState().addNode(sticky('b'))
    expect(store.getState().saveStatus.kind).toBe('saving') // لا نخفي «جارٍ الحفظ»
    storage.gate = null
    release()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 2)
    expect(storage.saves.length).toBeGreaterThanOrEqual(2)
    expect(ids(storage.saves.at(-1))).toEqual(['a', 'b'])
    expect(store.getState().saveStatus.kind).toBe('saved')
  })

  it('serializes writes: two flushes never run concurrently', async () => {
    let active = 0
    let maxActive = 0
    const slow = {
      saveCanvas: async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 50))
        active -= 1
      },
    }
    const persistence = createCanvasPersistence({ workspaceId: 'w', store, storage: slow })
    store.getState().addNode(sticky('a'))
    const first = persistence.flush()
    store.getState().addNode(sticky('b'))
    const second = persistence.flush()
    await vi.advanceTimersByTimeAsync(500)
    await Promise.all([first, second])
    expect(maxActive).toBe(1)
  })
})
