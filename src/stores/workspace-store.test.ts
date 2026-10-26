import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageAdapter } from '@/services/persistence/local-storage-adapter'
import { StorageError, type KeyValueStore, type StorageAdapter } from '@/services/persistence/storage-adapter'
import type { WorkspaceInput } from '@/features/workspaces/types/workspace'
import { createWorkspaceStore } from './workspace-store'
import { useUiStore } from './ui-store'

class FakeStore implements KeyValueStore {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const input: WorkspaceInput = { name: 'Learning Roadmap', description: 'Plan', color: 'violet', icon: 'compass' }

async function setup() {
  const kv = new FakeStore()
  const adapter = new LocalStorageAdapter(kv)
  const store = createWorkspaceStore(adapter)
  await store.getState().hydrate()
  return { kv, adapter, store }
}

beforeEach(() => {
  useUiStore.setState({ toasts: [] })
})

describe('workspace store', () => {
  it('starts in the loading state and becomes ready after hydration', async () => {
    const store = createWorkspaceStore(new LocalStorageAdapter(new FakeStore()))
    expect(store.getState().status).toBe('loading')
    await store.getState().hydrate()
    expect(store.getState().status).toBe('ready')
  })

  it('creates a workspace, puts it first, and persists it', async () => {
    const { adapter, store } = await setup()
    const a = store.getState().createWorkspace(input)
    const b = store.getState().createWorkspace({ ...input, name: 'Second' })
    await store.getState().flushSaves()

    expect(store.getState().workspaces.map((w) => w.id)).toEqual([b.id, a.id])
    expect((await adapter.loadWorkspaces()).workspaces).toHaveLength(2)
  })

  it('restores saved workspaces on a fresh store (simulated refresh)', async () => {
    const { kv, store } = await setup()
    const created = store.getState().createWorkspace(input)
    await store.getState().flushSaves()

    const reloaded = createWorkspaceStore(new LocalStorageAdapter(kv))
    await reloaded.getState().hydrate()
    expect(reloaded.getState().workspaces[0]).toEqual(created)
  })

  it('rejects invalid input instead of storing it', async () => {
    const { store } = await setup()
    expect(() => store.getState().createWorkspace({ ...input, name: '   ' })).toThrow()
    expect(store.getState().workspaces).toHaveLength(0)
  })

  it('updates fields and bumps updatedAt, but not when nothing changed', async () => {
    const { store } = await setup()
    const created = store.getState().createWorkspace(input)
    vi.spyOn(Date, 'now').mockReturnValue(created.updatedAt + 5000)

    store.getState().updateWorkspace(created.id, { name: 'Renamed', color: 'rose' })
    const updated = store.getState().workspaces[0]
    expect(updated).toMatchObject({ name: 'Renamed', color: 'rose', updatedAt: created.updatedAt + 5000 })

    vi.spyOn(Date, 'now').mockReturnValue(created.updatedAt + 9000)
    store.getState().updateWorkspace(created.id, { name: 'Renamed' })
    expect(store.getState().workspaces[0]?.updatedAt).toBe(created.updatedAt + 5000)
  })

  it('duplicates a workspace including its stored canvas data', async () => {
    const { adapter, store } = await setup()
    const source = store.getState().createWorkspace(input)
    await adapter.saveCanvas(source.id, { schemaVersion: 1, nodes: [{ id: 'n' }], edges: [], viewport: { x: 1, y: 2, zoom: 1 } })

    const copy = await store.getState().duplicateWorkspace(source.id)
    expect(copy?.name).toBe('Learning Roadmap (copy)')
    expect(copy?.id).not.toBe(source.id)
    expect((await adapter.loadCanvas(copy?.id ?? '')).canvas?.nodes).toEqual([{ id: 'n' }])
  })

  it('deletes a workspace and its canvas data', async () => {
    const { adapter, store } = await setup()
    const created = store.getState().createWorkspace(input)
    await adapter.saveCanvas(created.id, { schemaVersion: 1, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })

    await store.getState().deleteWorkspace(created.id)
    expect(store.getState().workspaces).toHaveLength(0)
    expect((await adapter.loadCanvas(created.id)).canvas).toBeNull()
    expect((await adapter.loadWorkspaces()).workspaces).toHaveLength(0)
  })

  it('markOpened sets lastOpenedAt without changing updatedAt', async () => {
    const { store } = await setup()
    const created = store.getState().createWorkspace(input)
    store.getState().markOpened(created.id)
    const opened = store.getState().workspaces[0]
    expect(opened?.lastOpenedAt).not.toBeNull()
    expect(opened?.updatedAt).toBe(created.updatedAt)
  })

  it('shows an error toast when saving fails, and keeps the in-memory change', async () => {
    const failing: StorageAdapter = {
      ...new LocalStorageAdapter(new FakeStore()),
      loadWorkspaces: async () => ({ workspaces: [], discardedCount: 0, unreadable: false, backupKey: null }),
      saveWorkspaces: async () => {
        throw new StorageError('quota', 'full')
      },
      subscribeToExternalChanges: () => () => undefined,
    } as unknown as StorageAdapter
    const store = createWorkspaceStore(failing)
    await store.getState().hydrate()

    store.getState().createWorkspace(input)
    await store.getState().flushSaves()

    expect(store.getState().workspaces).toHaveLength(1)
    expect(useUiStore.getState().toasts[0]).toMatchObject({ kind: 'error' })
    expect(useUiStore.getState().toasts[0]?.message).toMatch(/storage is full/i)
  })

  it('does not delete canvas data when saving the new list failed', async () => {
    const deleteCanvas = vi.fn(async () => undefined)
    const adapter = {
      loadWorkspaces: async () => ({ workspaces: [], discardedCount: 0, unreadable: false, backupKey: null }),
      saveWorkspaces: async () => {
        throw new StorageError('unknown', 'nope')
      },
      copyCanvas: async () => undefined,
      deleteCanvas,
      subscribeToExternalChanges: () => () => undefined,
    } as unknown as StorageAdapter
    const store = createWorkspaceStore(adapter)
    await store.getState().hydrate()
    const created = store.getState().createWorkspace(input)
    await store.getState().deleteWorkspace(created.id)
    expect(deleteCanvas).not.toHaveBeenCalled()
  })

  it('never lets an older save overwrite a newer state (saves run in order, reading latest state)', async () => {
    const writes: string[][] = []
    const adapter = {
      loadWorkspaces: async () => ({ workspaces: [], discardedCount: 0, unreadable: false, backupKey: null }),
      saveWorkspaces: async (list: readonly { name: string }[]) => {
        // الحفظ الأول أبطأ عمداً؛ لو لم يكن الطابور متسلسلاً لانتهى بعد الثاني وكتب حالة قديمة
        await new Promise((resolve) => setTimeout(resolve, writes.length === 0 ? 20 : 0))
        writes.push(list.map((w) => w.name))
      },
      subscribeToExternalChanges: () => () => undefined,
    } as unknown as StorageAdapter
    const store = createWorkspaceStore(adapter)
    await store.getState().hydrate()

    store.getState().createWorkspace({ ...input, name: 'First' })
    store.getState().createWorkspace({ ...input, name: 'Second' })
    await store.getState().flushSaves()

    expect(writes[writes.length - 1]).toEqual(['Second', 'First'])
  })

  it('warns once when storage is not persistent', async () => {
    const store = createWorkspaceStore(new LocalStorageAdapter(new FakeStore()), { persistent: false })
    await store.getState().hydrate()
    expect(useUiStore.getState().toasts.some((t) => /won't be kept/i.test(t.message))).toBe(true)
  })

  it('reports unreadable saved data with a backup notice', async () => {
    const kv = new FakeStore()
    kv.data.set('infinitespace:v1:workspaces', '{corrupt')
    const store = createWorkspaceStore(new LocalStorageAdapter(kv))
    await store.getState().hydrate()
    expect(store.getState().workspaces).toEqual([])
    expect(useUiStore.getState().toasts[0]?.message).toMatch(/backup copy/i)
  })
})

describe('recordCanvasSummary', () => {
  const summary = { nodeCount: 3, preview: [{ kind: 'sticky' as const, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] }

  it('updates the item count and preview, and persists them', async () => {
    const { adapter, store } = await setup()
    const ws = store.getState().createWorkspace(input)
    store.getState().recordCanvasSummary(ws.id, summary, true)
    await store.getState().flushSaves()
    const stored = (await adapter.loadWorkspaces()).workspaces.find((w) => w.id === ws.id)
    expect(stored?.nodeCount).toBe(3)
    expect(stored?.preview).toEqual(summary.preview)
  })

  it('bumps "last modified" only when the content changed (not for view-only saves)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const { store } = await setup()
      const ws = store.getState().createWorkspace(input)
      const created = store.getState().workspaces[0]?.updatedAt ?? 0
      vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
      store.getState().recordCanvasSummary(ws.id, summary, false)
      expect(store.getState().workspaces[0]?.updatedAt).toBe(created)
      store.getState().recordCanvasSummary(ws.id, summary, true)
      expect(store.getState().workspaces[0]?.updatedAt).toBeGreaterThan(created)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a workspace that no longer exists', async () => {
    const { store } = await setup()
    store.getState().recordCanvasSummary('ghost', summary, true)
    expect(store.getState().workspaces).toHaveLength(0)
  })
})
