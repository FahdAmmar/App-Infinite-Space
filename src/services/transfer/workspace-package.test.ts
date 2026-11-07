// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { blobToBase64 } from '@/lib/base64'
import { edge, imageNode, linkNode, pngBlob, stickyNode } from './fixtures'
import { PACKAGE_FORMAT, PACKAGE_VERSION, buildPackage, makeExportFileName, parsePackage } from './workspace-package'
import { createStickyNote } from '@/features/canvas/utils/node-factory'
import { withLocked, withStatus } from '@/features/canvas/utils/card-flags'

async function validImage() {
  return { type: 'image/png', data: await blobToBase64(pngBlob()) }
}

async function packageText(overrides: Record<string, unknown> = {}): Promise<string> {
  return JSON.stringify({
    format: PACKAGE_FORMAT,
    version: 1,
    exportedAt: 1,
    workspace: { name: 'Research', description: 'Notes', color: 'rose', icon: 'compass' },
    canvas: {
      schemaVersion: 1,
      nodes: [stickyNode('s1'), imageNode('i1', 'img-1'), stickyNode('s2')],
      edges: [edge('e1', 's1', 's2')],
      viewport: { x: 5, y: 6, zoom: 1.5 },
    },
    images: { 'img-1': await validImage() },
    ...overrides,
  })
}

function parsed(text: string) {
  const result = parsePackage(text, 1000)
  if (!result.ok) throw new Error(`expected ok but got: ${result.message}`)
  return result.value
}

describe('parsePackage: valid files', () => {
  it('reads the workspace, canvas, viewport and referenced images', async () => {
    const value = parsed(await packageText())
    expect(value.workspace).toEqual({ name: 'Research', description: 'Notes', color: 'rose', icon: 'compass' })
    expect(value.canvas.nodes.map((n) => n.id)).toEqual(['s1', 'i1', 's2'])
    expect(value.canvas.edges).toHaveLength(1)
    expect(value.canvas.viewport).toEqual({ x: 5, y: 6, zoom: 1.5 })
    expect([...value.images.keys()]).toEqual(['img-1'])
    expect(value.invalidImages).toBe(0)
  })

  it('keeps Arabic names and text intact', async () => {
    const text = await packageText({
      workspace: { name: 'خطة التعلم', description: 'ملاحظات', color: 'moss', icon: 'book-open' },
    })
    expect(parsed(text).workspace.name).toBe('خطة التعلم')
  })

  it('accepts a file with no edges, no images and no viewport', () => {
    const text = JSON.stringify({ format: PACKAGE_FORMAT, version: 1, workspace: { name: 'X' }, canvas: { nodes: [] } })
    const value = parsed(text)
    expect(value.canvas.edges).toEqual([])
    expect(value.canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('parsePackage: rejects unusable files with a clear reason', () => {
  it.each([
    ['not json at all', '{broken', /valid JSON/],
    ['a JSON array', '[]', /isn't an InfiniteSpace/],
    ['another JSON document', '{"name":"package.json"}', /isn't an InfiniteSpace/],
    ['a wrong format tag', JSON.stringify({ format: 'other', version: 1 }), /isn't an InfiniteSpace/],
    ['a missing version', JSON.stringify({ format: PACKAGE_FORMAT }), /invalid version/],
    ['a fractional version', JSON.stringify({ format: PACKAGE_FORMAT, version: 1.5 }), /invalid version/],
    ['a newer version', JSON.stringify({ format: PACKAGE_FORMAT, version: 3, canvas: { nodes: [] } }), /newer version/],
    ['no canvas', JSON.stringify({ format: PACKAGE_FORMAT, version: 1 }), /no canvas/],
    ['nodes that are not an array', JSON.stringify({ format: PACKAGE_FORMAT, version: 1, canvas: { nodes: {} } }), /no canvas/],
  ])('rejects %s', (_label, text, message) => {
    const result = parsePackage(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(message)
  })
})

describe('parsePackage: hostile content is neutralized', () => {
  it('blanks a javascript: link address', async () => {
    const text = await packageText({
      canvas: { schemaVersion: 1, nodes: [linkNode('l1', 'javascript:alert(1)')], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    })
    const node = parsed(text).canvas.nodes[0]
    expect(node?.type === 'link' && node.data.url).toBe('')
  })

  it('counts and skips damaged nodes and dangling edges instead of failing', async () => {
    const text = await packageText({
      canvas: {
        schemaVersion: 1,
        nodes: [stickyNode('s1'), { id: 5 }, null, stickyNode('s1')],
        edges: [edge('e1', 's1', 'ghost')],
        viewport: {},
      },
    })
    const value = parsed(text)
    expect(value.canvas.nodes).toHaveLength(1)
    expect(value.canvas.edges).toHaveLength(0)
    expect(value.canvas.discardedCount).toBeGreaterThanOrEqual(3)
  })

  it('falls back to safe defaults for a missing name, unknown color and unknown icon', async () => {
    const text = await packageText({ workspace: { name: '   ', description: 5, color: 'neon', icon: 'skull' } })
    const { workspace } = parsed(text)
    expect(workspace.name).toBe('Imported workspace')
    expect(workspace.description).toBe('')
    expect(workspace.color).toBe('lapis')
    expect(workspace.icon).toBe('sparkles')
  })

  it('truncates an overlong name to the normal limit', async () => {
    const text = await packageText({ workspace: { name: 'N'.repeat(500), description: '' } })
    expect(parsed(text).workspace.name).toHaveLength(60)
  })

  it('ignores images that no card references', async () => {
    const text = await packageText({ images: { 'img-1': await validImage(), stray: await validImage() } })
    expect([...parsed(text).images.keys()]).toEqual(['img-1'])
  })

  it.each([
    ['an SVG (can carry scripts)', { type: 'image/svg+xml', data: 'QUJD' }],
    ['a non-image type', { type: 'text/html', data: 'QUJD' }],
    ['text that is not base64', { type: 'image/png', data: 'not base64!' }],
    ['a data: URL instead of raw base64', { type: 'image/png', data: 'data:image/png;base64,QUJD' }],
    ['an empty payload', { type: 'image/png', data: '' }],
    ['a missing payload', { type: 'image/png' }],
    ['a non-object entry', 'oops'],
  ])('counts %s as an invalid image and drops it', async (_label, entry) => {
    const value = parsed(await packageText({ images: { 'img-1': entry } }))
    expect(value.images.size).toBe(0)
    expect(value.invalidImages).toBe(1)
  })

  it('rejects an image above the per-file size limit', async () => {
    const huge = 'A'.repeat(14 * 1024 * 1024) // ≈ 10.5MB بعد الفك
    const value = parsed(await packageText({ images: { 'img-1': { type: 'image/png', data: huge } } }))
    expect(value.images.size).toBe(0)
    expect(value.invalidImages).toBe(1)
  })

  it('treats an image id of "__proto__" as an ordinary key without polluting prototypes', async () => {
    const image = JSON.stringify(await validImage())
    const text = JSON.stringify({
      format: PACKAGE_FORMAT,
      version: 1,
      workspace: { name: 'P' },
      canvas: { nodes: [imageNode('i1', '__proto__')] },
    }).replace(/}$/, `,"images":{"__proto__":${image}}}`)
    const value = parsed(text)
    expect(value.images.has('__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).type).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'data')).toBe(false)
  })

  it('refuses a payload above the overall size limit', () => {
    const result = parsePackage('x'.repeat(256 * 1024 * 1024 + 1))
    expect(result.ok).toBe(false)
  })
})

describe('makeExportFileName', () => {
  const date = new Date('2026-10-27T12:00:00Z')

  it('adds the date and the double extension', () => {
    expect(makeExportFileName('Research', date)).toBe('Research-2026-10-27.infinitespace.json')
  })

  it('keeps Arabic letters', () => {
    expect(makeExportFileName('خطة التعلم', date)).toBe('خطة التعلم-2026-10-27.infinitespace.json')
  })

  it('replaces characters Windows forbids and collapses spaces', () => {
    expect(makeExportFileName('a/b\\c:d*e?f"g<h>i|j', date)).toBe('a b c d e f g h i j-2026-10-27.infinitespace.json')
  })

  it('does not produce a hidden file or an empty base', () => {
    expect(makeExportFileName('..secret', date)).toBe('secret-2026-10-27.infinitespace.json')
    expect(makeExportFileName('///', date)).toBe('workspace-2026-10-27.infinitespace.json')
  })

  it('caps a long name', () => {
    const name = makeExportFileName('x'.repeat(200), date)
    expect(name.length).toBeLessThanOrEqual(60 + '-2026-10-27.infinitespace.json'.length)
  })
})

describe('package version 2: status and lock', () => {
  it('writes the current version and a status/lock survives export then import', () => {
    const note = withLocked(withStatus({ ...createStickyNote({ x: 0, y: 0 }, 1), id: 'n1' }, 'done', 2), true, 3)
    const built = buildPackage({
      workspace: { name: 'W', description: '', color: 'rose', icon: 'compass' },
      nodes: [note],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      images: {},
      exportedAt: 4,
    })
    expect(built.version).toBe(PACKAGE_VERSION)
    expect(PACKAGE_VERSION).toBe(2)
    const out = parsed(JSON.stringify(built))
    expect(out.canvas.nodes[0]?.data.status).toBe('done')
    expect(out.canvas.nodes[0]?.data.locked).toBe(true)
    expect(out.canvas.nodes[0]?.draggable).toBe(false)
  })
})
