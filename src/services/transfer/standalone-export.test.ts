// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { serializeCanvas } from '@/features/canvas/persistence/canvas-codec'
import { createStickyNote } from '@/features/canvas/utils/node-factory'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { createWorkspaceMeta } from '@/features/workspaces/utils/factory'
import { TransferError } from './transfer-error'
import { exportStandaloneViewer, makeViewerFileName } from './standalone-export'

const workspace: WorkspaceMeta = createWorkspaceMeta({ name: 'My plan', description: 'd', color: 'violet', icon: 'sparkles' }, 1)
const note = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'n1' }
const stored = serializeCanvas([note], [], { x: 0, y: 0, zoom: 1 })
const imageStorage = { load: async () => null }
const text = async (blob: Blob): Promise<string> => blob.text()

describe('makeViewerFileName', () => {
  it('names the file after the workspace and the date, ending in .html', () => {
    expect(makeViewerFileName('My plan', new Date('2026-11-01T10:00:00Z'))).toBe('My plan-2026-11-01.html')
  })
  it('strips characters that are not allowed in file names', () => {
    expect(makeViewerFileName('a/b:c', new Date('2026-11-01T10:00:00Z'))).toMatch(/^a b c-2026-11-01\.html$/)
  })
})

describe('exportStandaloneViewer', () => {
  it('produces an HTML page with the cards', async () => {
    const result = await exportStandaloneViewer(workspace, {
      storage: { loadCanvas: async () => ({ canvas: stored, unreadable: false, backupKey: null }) },
      imageStorage,
      now: () => Date.UTC(2026, 10, 1),
    })
    const html = await text(result.blob)
    expect(result.blob.type).toBe('text/html')
    expect(result.fileName).toBe('My plan-2026-11-01.html')
    expect(html).toContain('<title>My plan</title>')
    expect(html).toContain('"id":"n1"')
  })

  it('exports an empty workspace as an empty viewer instead of failing', async () => {
    const result = await exportStandaloneViewer(workspace, {
      storage: { loadCanvas: async () => ({ canvas: null, unreadable: false, backupKey: null }) },
      imageStorage,
    })
    expect(await text(result.blob)).toContain('"nodes":[]')
  })

  it('refuses to export an unreadable workspace rather than exporting an empty one', async () => {
    await expect(
      exportStandaloneViewer(workspace, { storage: { loadCanvas: async () => ({ canvas: null, unreadable: true, backupKey: 'b' }) }, imageStorage }),
    ).rejects.toMatchObject({ kind: 'unreadable' })
  })

  it('reports a storage failure as a transfer error', async () => {
    const failing = exportStandaloneViewer(workspace, {
      storage: { loadCanvas: async () => Promise.reject(new Error('boom')) },
      imageStorage,
    })
    await expect(failing).rejects.toBeInstanceOf(TransferError)
    await expect(failing).rejects.toMatchObject({ kind: 'storage' })
  })

  it('counts image cards whose picture is not in this browser', async () => {
    const image = {
      id: 'i',
      type: 'image' as const,
      position: { x: 0, y: 0 },
      width: 200,
      height: 150,
      data: { createdAt: 1, updatedAt: 1, tags: [], imageId: 'gone', title: '', description: '', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10 },
    }
    const result = await exportStandaloneViewer(workspace, {
      storage: { loadCanvas: async () => ({ canvas: serializeCanvas([image], [], { x: 0, y: 0, zoom: 1 }), unreadable: false, backupKey: null }) },
      imageStorage,
    })
    expect(result).toMatchObject({ imageCount: 0, missingImages: 1 })
  })

  it('embeds a stored picture as a data URI', async () => {
    const image = {
      id: 'i',
      type: 'image' as const,
      position: { x: 0, y: 0 },
      width: 200,
      height: 150,
      data: { createdAt: 1, updatedAt: 1, tags: [], imageId: 'pic', title: '', description: '', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10 },
    }
    const result = await exportStandaloneViewer(workspace, {
      storage: { loadCanvas: async () => ({ canvas: serializeCanvas([image], [], { x: 0, y: 0, zoom: 1 }), unreadable: false, backupKey: null }) },
      imageStorage: { load: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) },
    })
    expect(result).toMatchObject({ imageCount: 1, missingImages: 0 })
    expect(await text(result.blob)).toContain('data:image/png;base64,AQID')
  })
})
