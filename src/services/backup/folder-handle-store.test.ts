import { describe, expect, it, vi } from 'vitest'
import type { DirectoryHandleLike } from './folder-backup'
import { createFolderHandleStore, type HandleBackend } from './folder-handle-store'

const handle = { name: 'Backups' } as unknown as DirectoryHandleLike

function memoryBackend(initial?: DirectoryHandleLike) {
  let value = initial
  const backend: HandleBackend = {
    get: vi.fn(async () => value),
    put: vi.fn(async (next) => void (value = next)),
    remove: vi.fn(async () => void (value = undefined)),
  }
  return backend
}

describe('createFolderHandleStore', () => {
  it('returns null when nothing was saved', async () => {
    expect(await createFolderHandleStore(memoryBackend()).load()).toBeNull()
  })

  it('reads the stored handle on the first load of a session, then serves it from memory', async () => {
    const backend = memoryBackend(handle)
    const store = createFolderHandleStore(backend)
    expect(await store.load()).toBe(handle)
    expect(await store.load()).toBe(handle)
    expect(backend.get).toHaveBeenCalledTimes(1)
  })

  it('re-reads from storage after the cache is forgotten (a new session)', async () => {
    const backend = memoryBackend()
    const store = createFolderHandleStore(backend)
    await store.save(handle)
    store.forgetCache()
    expect(await store.load()).toBe(handle)
    expect(backend.get).toHaveBeenCalledTimes(1)
  })

  it('forgets the handle once cleared, even if storage deletion fails', async () => {
    const backend = memoryBackend(handle)
    backend.remove = vi.fn(async () => {
      throw new Error('blocked')
    })
    const store = createFolderHandleStore(backend)
    await store.load()
    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('treats an unreadable store as "no folder" without caching the failure', async () => {
    const backend = memoryBackend()
    backend.get = vi.fn().mockRejectedValueOnce(new Error('idb down')).mockResolvedValueOnce(handle)
    const store = createFolderHandleStore(backend)
    expect(await store.load()).toBeNull()
    expect(await store.load()).toBe(handle)
  })
})
