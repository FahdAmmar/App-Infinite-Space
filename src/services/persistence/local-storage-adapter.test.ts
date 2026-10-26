import { describe, expect, it } from 'vitest'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import {
  LocalStorageAdapter,
  WORKSPACES_KEY,
  parseWorkspacesPayload,
  sanitizeWorkspace,
  toStorageError,
} from './local-storage-adapter'
import { StorageError, type KeyValueStore, type StoredCanvas } from './storage-adapter'

class FakeStore implements KeyValueStore {
  data = new Map<string, string>()
  failWrites: Error | null = null
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw this.failWrites
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const valid: WorkspaceMeta = {
  id: 'w1',
  name: 'My Projects',
  description: 'desc',
  color: 'moss',
  icon: 'rocket',
  createdAt: 10,
  updatedAt: 20,
  lastOpenedAt: 30,
  nodeCount: 2,
  preview: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4, kind: 'sticky' }],
}

const canvas: StoredCanvas = { schemaVersion: 1, nodes: [{ id: 'n1' }], edges: [], viewport: { x: 5, y: 6, zoom: 1.5 } }

describe('sanitizeWorkspace', () => {
  it('round-trips a valid workspace unchanged', () => {
    expect(sanitizeWorkspace(valid, 0)).toEqual(valid)
  })

  it('rejects non-objects and entries without an id or name', () => {
    expect(sanitizeWorkspace(null, 0)).toBeNull()
    expect(sanitizeWorkspace('x', 0)).toBeNull()
    expect(sanitizeWorkspace({ ...valid, id: '' }, 0)).toBeNull()
    expect(sanitizeWorkspace({ ...valid, name: '   ' }, 0)).toBeNull()
  })

  it('repairs unknown color/icon and bad numbers instead of dropping the workspace', () => {
    const repaired = sanitizeWorkspace(
      { ...valid, color: 'hotpink', icon: 'nope', nodeCount: -4, lastOpenedAt: 'yesterday', updatedAt: 'x' },
      999,
    )
    expect(repaired).toMatchObject({ color: 'lapis', icon: 'sparkles', nodeCount: 0, lastOpenedAt: null, updatedAt: 10 })
  })

  it('drops invalid preview rects and clamps coordinates', () => {
    const result = sanitizeWorkspace(
      {
        ...valid,
        preview: [
          { x: 5, y: -1, w: 0.2, h: 0.2, kind: 'image' },
          { x: 0, y: 0, w: 'a', h: 0, kind: 'image' },
          { x: 0, y: 0, w: 0, h: 0, kind: 'video' },
        ],
      },
      0,
    )
    expect(result?.preview).toEqual([{ x: 1, y: 0, w: 0.2, h: 0.2, kind: 'image' }])
  })

  it('ignores unknown extra fields (no prototype/field smuggling)', () => {
    const result = sanitizeWorkspace({ ...valid, __proto__: { admin: true }, extra: 'x' }, 0)
    expect(result).not.toHaveProperty('extra')
  })
})

describe('parseWorkspacesPayload', () => {
  it('returns null for invalid JSON, wrong shape, or a newer schema version', () => {
    expect(parseWorkspacesPayload('{not json', 0)).toBeNull()
    expect(parseWorkspacesPayload('[]', 0)).toBeNull()
    expect(parseWorkspacesPayload(JSON.stringify({ schemaVersion: 2, workspaces: [] }), 0)).toBeNull()
  })

  it('skips damaged entries and duplicate ids, and counts them', () => {
    const raw = JSON.stringify({ schemaVersion: 1, workspaces: [valid, { nope: true }, valid, { ...valid, id: 'w2' }] })
    const parsed = parseWorkspacesPayload(raw, 0)
    expect(parsed?.workspaces.map((w) => w.id)).toEqual(['w1', 'w2'])
    expect(parsed?.discardedCount).toBe(2)
  })
})

describe('LocalStorageAdapter', () => {
  it('returns an empty, readable result when nothing is stored yet', async () => {
    const adapter = new LocalStorageAdapter(new FakeStore())
    expect(await adapter.loadWorkspaces()).toEqual({ workspaces: [], discardedCount: 0, unreadable: false, backupKey: null })
  })

  it('saves and loads workspaces', async () => {
    const adapter = new LocalStorageAdapter(new FakeStore())
    await adapter.saveWorkspaces([valid])
    expect((await adapter.loadWorkspaces()).workspaces).toEqual([valid])
  })

  it('keeps a backup copy of unreadable content before it can be overwritten', async () => {
    const store = new FakeStore()
    store.data.set(WORKSPACES_KEY, '{corrupted')
    const loaded = await new LocalStorageAdapter(store).loadWorkspaces()

    expect(loaded.unreadable).toBe(true)
    expect(loaded.backupKey).not.toBeNull()
    expect(store.data.get(loaded.backupKey as string)).toBe('{corrupted')
  })

  it('reports unreadable content even when the backup cannot be written', async () => {
    const store = new FakeStore()
    store.data.set(WORKSPACES_KEY, '{corrupted')
    store.failWrites = new DOMException('full', 'QuotaExceededError')
    const loaded = await new LocalStorageAdapter(store).loadWorkspaces()
    expect(loaded).toMatchObject({ unreadable: true, backupKey: null })
  })

  it('maps a quota failure to StorageError("quota") on save', async () => {
    const store = new FakeStore()
    store.failWrites = new DOMException('full', 'QuotaExceededError')
    await expect(new LocalStorageAdapter(store).saveWorkspaces([valid])).rejects.toMatchObject({
      name: 'StorageError',
      reason: 'quota',
    })
  })

  it('copies canvas data to a new workspace id, and does nothing when there is none', async () => {
    const adapter = new LocalStorageAdapter(new FakeStore())
    await adapter.copyCanvas('missing', 'target')
    expect((await adapter.loadCanvas('target')).canvas).toBeNull()

    await adapter.saveCanvas('src', canvas)
    await adapter.copyCanvas('src', 'dst')
    expect((await adapter.loadCanvas('dst')).canvas).toEqual(canvas)
  })

  it('deletes canvas data', async () => {
    const adapter = new LocalStorageAdapter(new FakeStore())
    await adapter.saveCanvas('src', canvas)
    await adapter.deleteCanvas('src')
    expect((await adapter.loadCanvas('src')).canvas).toBeNull()
  })

  it('reports a stored canvas with an invalid shape as unreadable and keeps a backup copy', async () => {
    const store = new FakeStore()
    const raw = JSON.stringify({ schemaVersion: 1, nodes: 'x' })
    store.data.set('infinitespace:v1:canvas:bad', raw)
    const adapter = new LocalStorageAdapter(store)
    const loaded = await adapter.loadCanvas('bad')
    expect(loaded).toMatchObject({ canvas: null, unreadable: true })
    expect(loaded.backupKey).not.toBeNull()
    expect(store.data.get(loaded.backupKey ?? '')).toBe(raw)
    // قراءتها مرة ثانية لا تكدّس نسخاً جديدة
    const keysBefore = store.data.size
    await adapter.loadCanvas('bad')
    expect(store.data.size).toBe(keysBefore)
  })

  it('reports corrupted JSON as unreadable too', async () => {
    const store = new FakeStore()
    store.data.set('infinitespace:v1:canvas:broken', '{not json')
    expect(await new LocalStorageAdapter(store).loadCanvas('broken')).toMatchObject({ canvas: null, unreadable: true })
  })

  it('a missing canvas is not unreadable', async () => {
    expect(await new LocalStorageAdapter(new FakeStore()).loadCanvas('none')).toEqual({
      canvas: null,
      unreadable: false,
      backupKey: null,
    })
  })
})

describe('toStorageError', () => {
  it('classifies quota, security and unknown errors', () => {
    expect(toStorageError(new DOMException('x', 'QuotaExceededError')).reason).toBe('quota')
    expect(toStorageError(new DOMException('x', 'SecurityError')).reason).toBe('unavailable')
    expect(toStorageError(new Error('boom')).reason).toBe('unknown')
  })

  it('returns an existing StorageError as-is', () => {
    const original = new StorageError('quota', 'x')
    expect(toStorageError(original)).toBe(original)
  })
})
