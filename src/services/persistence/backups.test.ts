import { describe, expect, it } from 'vitest'
import { HybridStorageAdapter } from './hybrid-storage-adapter'
import { MemoryCanvasStore, type CanvasStore } from './indexed-db-canvas-store'
import { LocalStorageAdapter, describeBackupKey } from './local-storage-adapter'
import type { KeyValueStore } from './storage-adapter'

/** مخزن قابل للتعداد كـ localStorage الحقيقي (length و key). */
class EnumerableKv implements KeyValueStore {
  data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
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

describe('describeBackupKey', () => {
  it('recognizes a workspace-list backup and its timestamp', () => {
    expect(describeBackupKey('infinitespace:v1:workspaces:backup-1700000000000')).toEqual({
      kind: 'workspaces',
      workspaceId: null,
      createdAt: 1700000000000,
    })
  })

  it('recognizes a canvas backup and its workspace id', () => {
    expect(describeBackupKey('infinitespace:v1:canvas:abc-123:backup')).toEqual({
      kind: 'canvas',
      workspaceId: 'abc-123',
      createdAt: null,
    })
  })

  it.each(['infinitespace:v1:workspaces', 'infinitespace:v1:canvas:abc', 'infinitespace:v1:canvas::backup', 'other:key', 'infinitespace:v1:ui'])(
    'does not treat "%s" as a backup',
    (key) => {
      expect(describeBackupKey(key)).toBeNull()
    },
  )
})

describe('backups in localStorage', () => {
  it('lists only backup keys with their sizes', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:workspaces', '{"ok":true}')
    kv.setItem('infinitespace:v1:workspaces:backup-1700000000000', 'العربية') // 14 بايت بترميز UTF-8
    kv.setItem('infinitespace:v1:canvas:w1:backup', '{"bad":1}')
    kv.setItem('infinitespace:v1:ui', '{}')
    const backups = await new LocalStorageAdapter(kv).listBackups()
    expect(backups.map((b) => b.key).sort()).toEqual([
      'infinitespace:v1:canvas:w1:backup',
      'infinitespace:v1:workspaces:backup-1700000000000',
    ])
    expect(backups.find((b) => b.kind === 'workspaces')?.sizeBytes).toBe(14)
  })

  it('returns an empty list when the store cannot be enumerated', async () => {
    const plain: KeyValueStore = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    expect(await new LocalStorageAdapter(plain).listBackups()).toEqual([])
  })

  it('refuses to read or delete keys that are not backups', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:workspaces', 'precious')
    const adapter = new LocalStorageAdapter(kv)
    expect(await adapter.readBackup('infinitespace:v1:workspaces')).toBeNull()
    await adapter.deleteBackup('infinitespace:v1:workspaces')
    expect(kv.getItem('infinitespace:v1:workspaces')).toBe('precious')
  })

  it('reads and deletes a real backup', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:canvas:w1:backup', 'raw-content')
    const adapter = new LocalStorageAdapter(kv)
    expect(await adapter.readBackup('infinitespace:v1:canvas:w1:backup')).toBe('raw-content')
    await adapter.deleteBackup('infinitespace:v1:canvas:w1:backup')
    expect(kv.getItem('infinitespace:v1:canvas:w1:backup')).toBeNull()
  })
})

describe('HybridStorageAdapter backups', () => {
  it('merges localStorage and IndexedDB backups', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:workspaces:backup-1700000000000', '{}')
    const canvases = new MemoryCanvasStore()
    await canvases.putBackup('canvas-backup:w9', { schemaVersion: 99 })
    const adapter = new HybridStorageAdapter(new LocalStorageAdapter(kv), canvases)

    const backups = await adapter.listBackups()
    expect(backups).toHaveLength(2)
    expect(backups).toContainEqual(expect.objectContaining({ key: 'canvas-backup:w9', kind: 'canvas', workspaceId: 'w9' }))
    expect(await adapter.readBackup('canvas-backup:w9')).toEqual({ schemaVersion: 99 })

    await adapter.deleteBackup('canvas-backup:w9')
    expect(await adapter.readBackup('canvas-backup:w9')).toBeNull()
    expect(await adapter.listBackups()).toHaveLength(1)
  })

  it('still lists localStorage backups when IndexedDB cannot be read', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:canvas:w1:backup', '{}')
    const broken: CanvasStore = {
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      putBackup: () => Promise.resolve(),
      listBackups: () => Promise.reject(new Error('blocked')),
      getBackup: () => Promise.resolve(undefined),
      deleteBackup: () => Promise.resolve(),
    }
    const backups = await new HybridStorageAdapter(new LocalStorageAdapter(kv), broken).listBackups()
    expect(backups).toHaveLength(1)
  })

  it('works without IndexedDB', async () => {
    const kv = new EnumerableKv()
    kv.setItem('infinitespace:v1:canvas:w1:backup', '{}')
    const adapter = new HybridStorageAdapter(new LocalStorageAdapter(kv), null)
    expect(await adapter.listBackups()).toHaveLength(1)
    expect(await adapter.readBackup('canvas-backup:w1')).toBeNull()
  })
})
