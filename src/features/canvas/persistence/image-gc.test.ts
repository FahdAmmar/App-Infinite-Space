import { describe, expect, it, vi } from 'vitest'
import { MemoryImageStorage } from '@/services/persistence/image-storage'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import type { LoadedCanvas, LoadedWorkspaces } from '@/services/persistence/storage-adapter'
import { IMAGE_ORPHAN_GRACE_MS, collectUnusedImages } from './image-gc'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_000 * DAY

const ws = (id: string): WorkspaceMeta => ({
  id,
  name: id,
  description: '',
  color: 'violet',
  icon: 'compass',
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: 0,
  nodeCount: 0,
  preview: [],
})
const unreadableWorkspaces: LoadedWorkspaces = { workspaces: [], discardedCount: 0, unreadable: true, backupKey: null }

function fakeStorage(canvases: Record<string, LoadedCanvas>, workspaces: LoadedWorkspaces) {
  return {
    loadWorkspaces: () => Promise.resolve(workspaces),
    loadCanvas: (id: string) => Promise.resolve(canvases[id] ?? { canvas: null, unreadable: false, backupKey: null }),
  }
}
const canvasWith = (...imageIds: string[]): LoadedCanvas => ({
  canvas: {
    schemaVersion: 1,
    nodes: imageIds.map((imageId, i) => ({ id: `n${i}`, type: 'image', data: { imageId } })),
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  unreadable: false,
  backupKey: null,
})
const ok = (...ids: string[]): LoadedWorkspaces => ({ workspaces: ids.map(ws), discardedCount: 0, unreadable: false, backupKey: null })

/** صور مخزّنة بأعمار محددة */
function imagesAged(ages: Record<string, number>) {
  const list = Object.entries(ages).map(([id, ageMs]) => ({ id, createdAt: NOW - ageMs }))
  const remove = vi.fn(() => Promise.resolve())
  return { images: { list: () => Promise.resolve(list), remove }, remove }
}

describe('collectUnusedImages', () => {
  it('removes old images that no saved canvas references, keeping referenced ones', async () => {
    const { images, remove } = imagesAged({ used: 5 * DAY, orphan: 5 * DAY })
    const storage = fakeStorage({ w1: canvasWith('used') }, ok('w1'))
    expect(await collectUnusedImages({ storage, images, now: NOW })).toEqual({ removed: 1, skipped: false })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('orphan')
  })

  it('counts references across all workspaces', async () => {
    const { images, remove } = imagesAged({ a: 5 * DAY, b: 5 * DAY, c: 5 * DAY })
    const storage = fakeStorage({ w1: canvasWith('a'), w2: canvasWith('b') }, ok('w1', 'w2'))
    await collectUnusedImages({ storage, images, now: NOW })
    expect(remove.mock.calls).toEqual([['c']])
  })

  it('never removes an image younger than the grace period, even if unreferenced', async () => {
    const { images, remove } = imagesAged({ fresh: IMAGE_ORPHAN_GRACE_MS - 1000, stale: IMAGE_ORPHAN_GRACE_MS + 1000 })
    await collectUnusedImages({ storage: fakeStorage({}, ok()), images, now: NOW })
    expect(remove.mock.calls).toEqual([['stale']])
  })

  it('skips entirely when the workspace list is unreadable (references unknown)', async () => {
    const { images, remove } = imagesAged({ orphan: 9 * DAY })
    const storage = fakeStorage({}, unreadableWorkspaces)
    expect(await collectUnusedImages({ storage, images, now: NOW })).toEqual({ removed: 0, skipped: true })
    expect(remove).not.toHaveBeenCalled()
  })

  it('skips entirely when any canvas is unreadable (it may reference images we cannot see)', async () => {
    const { images, remove } = imagesAged({ maybeUsed: 9 * DAY })
    const storage = fakeStorage({ w2: { canvas: null, unreadable: true, backupKey: 'b' } }, ok('w1', 'w2'))
    expect(await collectUnusedImages({ storage, images, now: NOW })).toEqual({ removed: 0, skipped: true })
    expect(remove).not.toHaveBeenCalled()
  })

  it('skips on any storage error instead of deleting', async () => {
    const { images, remove } = imagesAged({ orphan: 9 * DAY })
    const storage = { loadWorkspaces: () => Promise.reject(new Error('blocked')), loadCanvas: () => Promise.reject(new Error('x')) }
    expect(await collectUnusedImages({ storage, images, now: NOW })).toEqual({ removed: 0, skipped: true })
    expect(remove).not.toHaveBeenCalled()
  })

  it('works with the real in-memory image storage', async () => {
    const images = new MemoryImageStorage()
    const used = await images.save(new Blob(['a']))
    const orphan = await images.save(new Blob(['b']))
    const storage = fakeStorage({ w: canvasWith(used) }, ok('w'))
    const result = await collectUnusedImages({ storage, images, now: Date.now() + 3 * DAY })
    expect(result.removed).toBe(1)
    expect(await images.load(used)).not.toBeNull()
    expect(await images.load(orphan)).toBeNull()
  })
})
