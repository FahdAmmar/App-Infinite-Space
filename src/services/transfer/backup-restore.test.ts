import { describe, expect, it } from 'vitest'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { createMemoryBackend, edge, stickyNode } from './fixtures'
import { restoreCanvasBackup, restoreWorkspaceList, salvageCanvas, salvageWorkspaces } from './backup-restore'

const goodMeta = { id: 'w1', name: 'Alpha', description: '', color: 'moss', icon: 'code', createdAt: 1, updatedAt: 2 }

describe('salvageCanvas', () => {
  it('recovers cards from content written by a newer app version', () => {
    const decoded = salvageCanvas({ schemaVersion: 99, nodes: [stickyNode('a'), stickyNode('b')], edges: [edge('e', 'a', 'b')], extra: true })
    expect(decoded?.nodes).toHaveLength(2)
    expect(decoded?.edges).toHaveLength(1)
    expect(decoded?.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('reads a backup stored as a JSON string', () => {
    const decoded = salvageCanvas(JSON.stringify({ nodes: [stickyNode('a')] }))
    expect(decoded?.nodes).toHaveLength(1)
  })

  it('skips damaged cards and keeps the good ones', () => {
    const decoded = salvageCanvas({ nodes: [stickyNode('a'), { id: 1 }, 'junk'] })
    expect(decoded?.nodes).toHaveLength(1)
    expect(decoded?.discardedCount).toBe(2)
  })

  it.each([
    ['truncated JSON text', '{"nodes":[{"id":'],
    ['a number', 42],
    ['null', null],
    ['an object without nodes', { edges: [] }],
    ['nodes that are all damaged', { nodes: [{}, null] }],
    ['an empty node list', { nodes: [] }],
  ])('returns null for %s', (_label, raw) => {
    expect(salvageCanvas(raw)).toBeNull()
  })
})

describe('salvageWorkspaces', () => {
  it('returns the understandable workspaces, deduplicated', () => {
    const raw = JSON.stringify({ schemaVersion: 7, workspaces: [goodMeta, goodMeta, { id: 'w2' }, { ...goodMeta, id: 'w3', name: 'Beta' }] })
    expect(salvageWorkspaces(raw).map((w) => w.id)).toEqual(['w1', 'w3'])
  })

  it('returns an empty list for text it cannot parse', () => {
    expect(salvageWorkspaces('{oops')).toEqual([])
    expect(salvageWorkspaces({ workspaces: 'no' })).toEqual([])
  })
})

describe('restoreCanvasBackup', () => {
  it('adds the recovered canvas as a new workspace without touching the backup', async () => {
    const backend = createMemoryBackend()
    await backend.canvases.putBackup('canvas-backup:w1', { schemaVersion: 99, nodes: [stickyNode('a')] })
    const adopted: WorkspaceMeta[] = []
    const result = await restoreCanvasBackup(await backend.storage.readBackup('canvas-backup:w1'), {
      storage: backend.storage,
      adopt: (list) => (adopted.push(...list), Promise.resolve(true)),
      existingNames: [],
    })
    expect(result.workspace.name).toBe('Recovered workspace')
    expect(adopted).toHaveLength(1)
    expect((await backend.storage.loadCanvas(result.workspace.id)).canvas?.nodes).toHaveLength(1)
    expect(await backend.storage.readBackup('canvas-backup:w1')).not.toBeNull()
  })

  it('fails with "nothing" when the backup holds nothing recoverable', async () => {
    const backend = createMemoryBackend()
    await expect(
      restoreCanvasBackup('garbage', { storage: backend.storage, adopt: () => Promise.resolve(true), existingNames: [] }),
    ).rejects.toMatchObject({ kind: 'nothing' })
  })

  it('rolls the canvas back when the workspace cannot be registered', async () => {
    const backend = createMemoryBackend()
    await expect(
      restoreCanvasBackup({ nodes: [stickyNode('a')] }, { storage: backend.storage, adopt: () => Promise.resolve(false), existingNames: [] }),
    ).rejects.toMatchObject({ kind: 'storage' })
    expect(backend.canvases.canvases.size).toBe(0)
  })
})

describe('restoreWorkspaceList', () => {
  const raw = JSON.stringify({ workspaces: [goodMeta, { ...goodMeta, id: 'w2', name: 'Beta' }] })

  it('adds only the workspaces that are not already present', async () => {
    const adopted: WorkspaceMeta[] = []
    const restored = await restoreWorkspaceList(raw, {
      adopt: (list) => (adopted.push(...list), Promise.resolve(true)),
      existingIds: new Set(['w1']),
    })
    expect(restored.map((w) => w.id)).toEqual(['w2'])
    expect(adopted).toHaveLength(1)
  })

  it('says there is nothing to do when every workspace already exists', async () => {
    await expect(restoreWorkspaceList(raw, { adopt: () => Promise.resolve(true), existingIds: new Set(['w1', 'w2']) })).rejects.toMatchObject({
      kind: 'nothing',
    })
  })

  it('reports a storage failure when the list cannot be saved', async () => {
    await expect(restoreWorkspaceList(raw, { adopt: () => Promise.resolve(false), existingIds: new Set() })).rejects.toMatchObject({ kind: 'storage' })
  })
})
