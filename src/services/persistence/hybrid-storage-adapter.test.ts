import { describe, expect, it } from 'vitest'
import { HybridStorageAdapter } from './hybrid-storage-adapter'
import { MemoryCanvasStore, type CanvasStore } from './indexed-db-canvas-store'
import { LocalStorageAdapter } from './local-storage-adapter'
import type { KeyValueStore, StoredCanvas } from './storage-adapter'

class FakeKv implements KeyValueStore {
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

const canvas: StoredCanvas = { schemaVersion: 1, nodes: [{ id: 'a' }], edges: [], viewport: { x: 1, y: 2, zoom: 1 } }

function setup() {
  const kv = new FakeKv()
  const canvases = new MemoryCanvasStore()
  return { kv, canvases, adapter: new HybridStorageAdapter(new LocalStorageAdapter(kv), canvases) }
}

describe('HybridStorageAdapter (IndexedDB available)', () => {
  it('stores canvases in the canvas store, not in localStorage', async () => {
    const { adapter, kv, canvases } = setup()
    await adapter.saveCanvas('w', canvas)
    expect(canvases.canvases.has('w')).toBe(true)
    expect([...kv.data.keys()].some((k) => k.includes('canvas'))).toBe(false)
    expect((await adapter.loadCanvas('w')).canvas).toEqual(canvas)
  })

  it('reports a missing canvas as empty, not unreadable', async () => {
    expect(await setup().adapter.loadCanvas('none')).toEqual({ canvas: null, unreadable: false, backupKey: null })
  })

  it('reports an unreadable canvas and keeps a backup (stable key, no pile-up)', async () => {
    const { adapter, canvases } = setup()
    await canvases.put('w', { schemaVersion: 99, nodes: 'future format' })
    const first = await adapter.loadCanvas('w')
    expect(first).toMatchObject({ canvas: null, unreadable: true, backupKey: 'canvas-backup:w' })
    expect(canvases.backups.get('canvas-backup:w')).toEqual({ schemaVersion: 99, nodes: 'future format' })
    await adapter.loadCanvas('w')
    expect(canvases.backups.size).toBe(1)
  })

  it('still reports unreadable when the backup cannot be written', async () => {
    const failing: CanvasStore = {
      get: () => Promise.resolve({ nope: true }),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      putBackup: () => Promise.reject(new Error('full')),
    }
    const loaded = await new HybridStorageAdapter(new LocalStorageAdapter(new FakeKv()), failing).loadCanvas('w')
    expect(loaded).toEqual({ canvas: null, unreadable: true, backupKey: null })
  })

  it('copies and deletes canvases', async () => {
    const { adapter } = setup()
    await adapter.copyCanvas('missing', 'x')
    expect((await adapter.loadCanvas('x')).canvas).toBeNull()
    await adapter.saveCanvas('src', canvas)
    await adapter.copyCanvas('src', 'dst')
    expect((await adapter.loadCanvas('dst')).canvas).toEqual(canvas)
    await adapter.deleteCanvas('src')
    expect((await adapter.loadCanvas('src')).canvas).toBeNull()
    expect((await adapter.loadCanvas('dst')).canvas).toEqual(canvas)
  })

  it('maps quota and unknown failures to StorageError reasons', async () => {
    const quota: CanvasStore = {
      get: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
      put: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
      delete: () => Promise.reject(new Error('x')),
      putBackup: () => Promise.resolve(),
    }
    const adapter = new HybridStorageAdapter(new LocalStorageAdapter(new FakeKv()), quota)
    await expect(adapter.saveCanvas('w', canvas)).rejects.toMatchObject({ name: 'StorageError', reason: 'quota' })
    await expect(adapter.deleteCanvas('w')).rejects.toMatchObject({ name: 'StorageError', reason: 'unknown' })
    await expect(adapter.loadCanvas('w')).rejects.toMatchObject({ name: 'StorageError' })
  })

  it('keeps workspace metadata in localStorage', async () => {
    const { adapter, kv } = setup()
    await adapter.saveWorkspaces([])
    expect([...kv.data.keys()].length).toBeGreaterThan(0)
  })
})

describe('HybridStorageAdapter (IndexedDB unavailable)', () => {
  it('falls back to localStorage for canvases', async () => {
    const kv = new FakeKv()
    const adapter = new HybridStorageAdapter(new LocalStorageAdapter(kv), null)
    await adapter.saveCanvas('w', canvas)
    expect([...kv.data.keys()].some((k) => k.includes('canvas'))).toBe(true)
    expect((await adapter.loadCanvas('w')).canvas).toEqual(canvas)
  })
})
