import { describe, expect, it, vi } from 'vitest'
import { MemoryImageStorage, ResilientImageStorage, type ImageStorage } from './image-storage'

const blob = () => new Blob(['pixels'], { type: 'image/png' })

const brokenStorage = (): ImageStorage => ({
  save: () => Promise.reject(new Error('QuotaExceededError')),
  load: () => Promise.reject(new Error('unavailable')),
  remove: () => Promise.reject(new Error('unavailable')),
  list: () => Promise.reject(new Error('unavailable')),
})

describe('MemoryImageStorage', () => {
  it('round-trips a blob under a generated id', async () => {
    const storage = new MemoryImageStorage()
    const data = blob()
    const id = await storage.save(data)
    expect(await storage.load(id)).toBe(data)
  })

  it('returns null for unknown ids and forgets removed ones', async () => {
    const storage = new MemoryImageStorage()
    expect(await storage.load('nope')).toBeNull()
    const id = await storage.save(blob())
    await storage.remove(id)
    expect(await storage.load(id)).toBeNull()
  })
})

describe('list', () => {
  it('MemoryImageStorage lists ids with their creation time', async () => {
    const storage = new MemoryImageStorage()
    const before = Date.now()
    const id = await storage.save(blob())
    const [info] = await storage.list()
    expect(info?.id).toBe(id)
    expect(info?.createdAt).toBeGreaterThanOrEqual(before)
  })

  it('ResilientImageStorage lists what survived in memory when the primary is broken', async () => {
    const storage = new ResilientImageStorage(brokenStorage(), vi.fn())
    const id = await storage.save(blob())
    expect((await storage.list()).map((i) => i.id)).toEqual([id])
  })
})

describe('ResilientImageStorage', () => {
  it('uses the primary storage while it works', async () => {
    const primary = new MemoryImageStorage()
    const onFallback = vi.fn()
    const storage = new ResilientImageStorage(primary, onFallback)
    const id = await storage.save(blob())
    expect(await primary.load(id)).not.toBeNull()
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('falls back to memory on the first failed save and notifies exactly once', async () => {
    const onFallback = vi.fn()
    const storage = new ResilientImageStorage(brokenStorage(), onFallback)
    const first = await storage.save(blob())
    const second = await storage.save(blob())
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(await storage.load(first)).not.toBeNull()
    expect(await storage.load(second)).not.toBeNull()
  })

  it('treats an unreadable primary storage as a missing image rather than throwing', async () => {
    const storage = new ResilientImageStorage(brokenStorage(), vi.fn())
    expect(await storage.load('anything')).toBeNull()
  })

  it('does not throw when removal fails in the primary storage', async () => {
    const storage = new ResilientImageStorage(brokenStorage(), vi.fn())
    await expect(storage.remove('x')).resolves.toBeUndefined()
  })
})
