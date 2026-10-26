import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryImageStorage } from '@/services/persistence/image-storage'
import { acquireImageUrl, releaseImageUrl, resetImageUrlCache } from './image-url-cache'

let counter = 0
const created: string[] = []
const revoked: string[] = []

beforeEach(() => {
  counter = 0
  created.length = 0
  revoked.length = 0
  // jsdom لا يوفر createObjectURL؛ نحاكيه لنراقب الإنشاء والإلغاء
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${(counter += 1)}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url)
  })
})

afterEach(() => {
  resetImageUrlCache()
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function stored(storage: MemoryImageStorage): Promise<string> {
  return storage.save(new Blob(['x'], { type: 'image/png' }))
}

describe('image URL cache', () => {
  it('creates one URL per image and shares it between users of the same image', async () => {
    const storage = new MemoryImageStorage()
    const id = await stored(storage)
    const [a, b] = await Promise.all([acquireImageUrl(id, storage), acquireImageUrl(id, storage)])
    expect(a).toBe(b)
    expect(created).toHaveLength(1)
  })

  it('returns null for an image that is not in storage', async () => {
    expect(await acquireImageUrl('missing', new MemoryImageStorage())).toBeNull()
  })

  it('keeps a released image around for quick reuse instead of recreating it', async () => {
    const storage = new MemoryImageStorage()
    const id = await stored(storage)
    const first = await acquireImageUrl(id, storage)
    releaseImageUrl(id)
    const second = await acquireImageUrl(id, storage)
    expect(second).toBe(first)
    expect(created).toHaveLength(1)
    expect(revoked).toHaveLength(0)
  })

  it('revokes the oldest idle URLs beyond the idle limit, but never one still in use', async () => {
    const storage = new MemoryImageStorage()
    const inUseId = await stored(storage)
    const inUseUrl = await acquireImageUrl(inUseId, storage)
    for (let i = 0; i < 30; i += 1) {
      const id = await stored(storage)
      await acquireImageUrl(id, storage)
      releaseImageUrl(id)
    }
    await flush()
    expect(revoked.length).toBeGreaterThan(0)
    expect(revoked).not.toContain(inUseUrl)
  })

  it('ignores a release for an unknown image', () => {
    expect(() => releaseImageUrl('never-acquired')).not.toThrow()
  })
})
