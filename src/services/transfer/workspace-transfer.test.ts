import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { createWorkspaceMeta } from '@/features/workspaces/utils/factory'
import { StorageError } from '@/services/persistence/storage-adapter'
import { createMemoryBackend, edge, imageNode, pngBlob, stickyNode } from './fixtures'
import { TransferError } from './transfer-error'
import { exportWorkspace, importWorkspaceText, type ImportDeps } from './workspace-transfer'

const source = createWorkspaceMeta({ name: 'Source', description: 'Original', color: 'rose', icon: 'rocket' }, 1000)

async function seed(backend: ReturnType<typeof createMemoryBackend>, withImage = true) {
  const imageId = withImage ? await backend.images.save(pngBlob()) : 'gone'
  await backend.storage.saveCanvas(source.id, {
    schemaVersion: 1,
    nodes: [stickyNode('s1'), stickyNode('s2'), imageNode('i1', imageId)],
    edges: [edge('e1', 's1', 's2')],
    viewport: { x: 4, y: 5, zoom: 2 },
  })
  return imageId
}

function importDeps(backend: ReturnType<typeof createMemoryBackend>, overrides: Partial<ImportDeps> = {}) {
  const adopted: WorkspaceMeta[] = []
  const deps: ImportDeps = {
    storage: backend.storage,
    imageStorage: backend.images,
    adopt: (list) => {
      adopted.push(...list)
      return Promise.resolve(true)
    },
    existingNames: [],
    now: () => 5000,
    ...overrides,
  }
  return { deps, adopted }
}

describe('exportWorkspace', () => {
  it('packs the canvas and its images into one downloadable file', async () => {
    const backend = createMemoryBackend()
    await seed(backend)
    const result = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images, now: () => 1_700_000_000_000 })
    expect(result.fileName).toBe('Source-2023-11-14.infinitespace.json')
    expect(result.imageCount).toBe(1)
    expect(result.missingImages).toBe(0)
    const body = JSON.parse(await result.blob.text()) as { format: string; workspace: { name: string }; canvas: { nodes: unknown[] } }
    expect(body.format).toBe('infinitespace-workspace')
    expect(body.workspace.name).toBe('Source')
    expect(body.canvas.nodes).toHaveLength(3)
  })

  it('reports image cards whose file is gone instead of failing', async () => {
    const backend = createMemoryBackend()
    await seed(backend, false)
    const result = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    expect(result.imageCount).toBe(0)
    expect(result.missingImages).toBe(1)
  })

  it('exports an empty workspace that has no saved canvas yet', async () => {
    const backend = createMemoryBackend()
    const result = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    expect(JSON.parse(await result.blob.text()).canvas.nodes).toEqual([])
  })

  it('refuses to export unreadable content rather than exporting an empty canvas', async () => {
    const backend = createMemoryBackend()
    await backend.canvases.put(source.id, { schemaVersion: 99, nodes: 'future' })
    await expect(exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })).rejects.toMatchObject({
      name: 'TransferError',
      kind: 'unreadable',
    })
  })

  it('turns a storage failure into a TransferError', async () => {
    const failing = { loadCanvas: () => Promise.reject(new StorageError('unavailable', 'blocked')) }
    await expect(exportWorkspace(source, { storage: failing, imageStorage: createMemoryBackend().images })).rejects.toMatchObject({ kind: 'storage' })
  })
})

describe('importWorkspaceText: round trip', () => {
  it('recreates the workspace as a new one with fresh ids and its own copy of each image', async () => {
    const backend = createMemoryBackend()
    const originalImageId = await seed(backend)
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })

    // الاسم «Source» موجود أصلاً في القائمة، فيحصل المستورَد على لاحقة النسخة
    const { deps, adopted } = importDeps(backend, { existingNames: ['Source'] })
    const result = await importWorkspaceText(await exported.blob.text(), deps)

    expect(result.workspace.id).not.toBe(source.id)
    expect(adopted).toEqual([result.workspace])
    expect(result.workspace).toMatchObject({ name: 'Source (copy)', nodeCount: 3, color: 'rose', icon: 'rocket' })
    expect(result.missingImages).toBe(0)

    const stored = await backend.storage.loadCanvas(result.workspace.id)
    const nodes = (stored.canvas?.nodes ?? []) as Array<{ type: string; data: { imageId?: string } }>
    const newImageId = nodes.find((n) => n.type === 'image')?.data.imageId
    expect(newImageId).toBeTruthy()
    expect(newImageId).not.toBe(originalImageId)
    expect(await backend.images.load(newImageId ?? '')).not.toBeNull()
    expect(await backend.images.load(originalImageId)).not.toBeNull()
    expect(stored.canvas?.viewport).toEqual({ x: 4, y: 5, zoom: 2 })
  })

  it('keeps the original name when it is not taken', async () => {
    const backend = createMemoryBackend()
    await seed(backend)
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    const { deps } = importDeps(backend, { existingNames: ['Something else'] })
    expect((await importWorkspaceText(await exported.blob.text(), deps)).workspace.name).toBe('Source')
  })
})

describe('importWorkspaceText: failures leave nothing behind', () => {
  it('rejects a file that is not a workspace export without writing anything', async () => {
    const backend = createMemoryBackend()
    const { deps, adopted } = importDeps(backend)
    await expect(importWorkspaceText('{"hello":1}', deps)).rejects.toMatchObject({ kind: 'invalid' })
    expect(adopted).toHaveLength(0)
    expect(backend.canvases.canvases.size).toBe(0)
    expect(await backend.images.list()).toHaveLength(0)
  })

  it('rolls back the canvas and the images when the workspace cannot be registered', async () => {
    const backend = createMemoryBackend()
    await seed(backend)
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    const imagesBefore = (await backend.images.list()).length
    const canvasesBefore = backend.canvases.canvases.size

    const { deps } = importDeps(backend, { adopt: () => Promise.resolve(false) })
    await expect(importWorkspaceText(await exported.blob.text(), deps)).rejects.toMatchObject({ kind: 'storage' })
    expect((await backend.images.list()).length).toBe(imagesBefore)
    expect(backend.canvases.canvases.size).toBe(canvasesBefore)
  })

  it('rolls back the images when the canvas cannot be written', async () => {
    const backend = createMemoryBackend()
    await seed(backend)
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    const imagesBefore = (await backend.images.list()).length

    const failingStorage = {
      saveCanvas: () => Promise.reject(new StorageError('quota', 'full')),
      deleteCanvas: () => Promise.resolve(),
    }
    const { deps } = importDeps(backend, { storage: failingStorage })
    await expect(importWorkspaceText(await exported.blob.text(), deps)).rejects.toBeInstanceOf(TransferError)
    expect((await backend.images.list()).length).toBe(imagesBefore)
  })

  it('removes already-saved images when a later image fails to save', async () => {
    const backend = createMemoryBackend()
    const first = await backend.images.save(pngBlob())
    const second = await backend.images.save(pngBlob())
    await backend.storage.saveCanvas(source.id, {
      schemaVersion: 1,
      nodes: [imageNode('i1', first), imageNode('i2', second)],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    const before = (await backend.images.list()).length

    let calls = 0
    const flaky = {
      save: (blob: Blob) => (++calls === 2 ? Promise.reject(new Error('disk full')) : backend.images.save(blob)),
      remove: (id: string) => backend.images.remove(id),
    }
    const { deps } = importDeps(backend, { imageStorage: flaky })
    await expect(importWorkspaceText(await exported.blob.text(), deps)).rejects.toMatchObject({ kind: 'storage' })
    expect((await backend.images.list()).length).toBe(before)
  })
})

describe('importWorkspaceText: images', () => {
  it('shows "image unavailable" instead of linking to a stranger’s image when the file lacks the picture', async () => {
    const backend = createMemoryBackend()
    const victimImage = await backend.images.save(pngBlob())
    // ملف خبيث: بطاقة صورة تشير إلى معرّف صورة موجودة في هذا المتصفح لكن الملف لا يحمل بياناتها
    const text = JSON.stringify({
      format: 'infinitespace-workspace',
      version: 1,
      workspace: { name: 'Evil' },
      canvas: { nodes: [imageNode('i1', victimImage)] },
    })
    const { deps } = importDeps(backend)
    const result = await importWorkspaceText(text, deps)
    expect(result.missingImages).toBe(1)
    const stored = await backend.storage.loadCanvas(result.workspace.id)
    const imageId = (stored.canvas?.nodes as Array<{ data: { imageId: string } }>)[0]?.data.imageId
    expect(imageId).not.toBe(victimImage)
    expect(imageId).toMatch(/^missing-/)
  })

  it('treats an image that fails verification as missing and still imports the rest', async () => {
    const backend = createMemoryBackend()
    await seed(backend)
    const exported = await exportWorkspace(source, { storage: backend.storage, imageStorage: backend.images })
    const verifyImage = vi.fn(() => Promise.reject(new Error('not decodable')))
    const { deps } = importDeps(backend, { verifyImage })
    const result = await importWorkspaceText(await exported.blob.text(), deps)
    expect(verifyImage).toHaveBeenCalledOnce()
    expect(result.missingImages).toBe(1)
    expect(result.workspace.nodeCount).toBe(3)
  })
})
