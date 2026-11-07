import { describe, expect, it } from 'vitest'
import type { StoredCanvas } from '@/services/persistence/storage-adapter'
import { createEdge } from '../utils/edge-utils'
import { createGroup, createImageCard, createLinkCard, createStickyNote, createTextCard } from '../utils/node-factory'
import { MAX_NODES, collectImageIds, deserializeCanvas, serializeCanvas } from './canvas-codec'

const viewport = { x: 10, y: -20, zoom: 1.5 }
const stored = (nodes: unknown[], edges: unknown[] = [], vp = viewport): StoredCanvas => ({ schemaVersion: 1, nodes, edges, viewport: vp })

const rawSticky = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  type: 'sticky',
  position: { x: 1, y: 2 },
  width: 232,
  height: 208,
  data: { title: 't', content: 'c', color: 'blue', textColor: null, tags: ['a'], createdAt: 1, updatedAt: 2 },
  ...over,
})

describe('serializeCanvas / deserializeCanvas round trip', () => {
  it('restores every node type and edge exactly', () => {
    const sticky = { ...createStickyNote({ x: 100, y: 100 }, 5, 'pink'), id: 'a' }
    const text = { ...createTextCard({ x: 500, y: 100 }, 6), id: 'b' }
    const link = { ...createLinkCard({ x: 900, y: 100 }, 7), id: 'c' }
    link.data.url = 'https://example.com/'
    const image = {
      ...createImageCard({ x: 100, y: 500 }, 8, { imageId: 'img-1', fileName: 'a.png', naturalWidth: 800, naturalHeight: 400, width: 280 }),
      id: 'd',
    }
    const group = { ...createGroup({ x: 700, y: 600 }, 9), id: 'g' }
    const member = { ...createStickyNote({ x: 0, y: 0 }, 10), id: 'm', parentId: 'g', position: { x: 40, y: 60 } }
    const edge = createEdge('a', 'b', 'right', 'left', { label: 'leads to', arrow: 'both', color: 'pink' })

    const out = deserializeCanvas(serializeCanvas([group, sticky, text, link, image, member], [{ ...edge, id: 'e' }], viewport))
    expect(out.discardedCount).toBe(0)
    expect(out.viewport).toEqual(viewport)
    expect(out.nodes).toEqual([group, sticky, text, link, image, member])
    expect(out.edges).toEqual([{ ...edge, id: 'e' }])
  })

  it('does not store transient React Flow state', () => {
    const noisy = { ...createStickyNote({ x: 0, y: 0 }, 1), selected: true, dragging: true, measured: { width: 9, height: 9 }, resizing: true }
    const [node] = serializeCanvas([noisy], [], viewport).nodes
    expect(Object.keys(node as object).sort()).toEqual(['data', 'height', 'id', 'position', 'type', 'width'])
  })

  it('produces JSON-safe output', () => {
    const json = JSON.stringify(serializeCanvas([createStickyNote({ x: 0, y: 0 }, 1)], [], viewport))
    expect(JSON.parse(json).schemaVersion).toBe(2)
  })
})

describe('deserializeCanvas: untrusted input', () => {
  it('drops nodes that are not objects, have unknown types, or invalid positions, and counts them', () => {
    const out = deserializeCanvas(
      stored([
        rawSticky(),
        null,
        'x',
        rawSticky({ id: 's2', type: 'weird' }),
        rawSticky({ id: 's3', position: { x: NaN, y: 0 } }),
        rawSticky({ id: 's4', position: { x: 'a', y: 0 } }),
        rawSticky({ id: '' }),
      ]),
    )
    expect(out.nodes.map((n) => n.id)).toEqual(['s1'])
    expect(out.discardedCount).toBe(6)
  })

  it('drops duplicate node ids (keeps the first)', () => {
    const out = deserializeCanvas(stored([rawSticky(), rawSticky({ data: { title: 'second' } })]))
    expect(out.nodes).toHaveLength(1)
    expect(out.nodes[0]?.type === 'sticky' && out.nodes[0].data.title).toBe('t')
    expect(out.discardedCount).toBe(1)
  })

  it('repairs fields: unknown color, bad text color, huge text, tags', () => {
    const out = deserializeCanvas(
      stored([
        rawSticky({
          data: { title: 'x'.repeat(9999), content: 5, color: 'neon', textColor: 'red; background:url(x)', tags: ['ok', '#ok', 7, 'two words'], createdAt: 'x' },
        }),
      ]),
      999,
    )
    const node = out.nodes[0]
    expect(node?.type).toBe('sticky')
    if (node?.type !== 'sticky') return
    expect(node.data.title).toHaveLength(120)
    expect(node.data.content).toBe('')
    expect(node.data.color).toBe('yellow')
    expect(node.data.textColor).toBeNull()
    expect(node.data.tags).toEqual(['ok', 'two-words'])
    expect(node.data.createdAt).toBe(999)
  })

  it('accepts a valid hex text color', () => {
    const node = deserializeCanvas(stored([rawSticky({ data: { textColor: '#AbCdEf' } })])).nodes[0]
    expect(node?.type === 'sticky' && node.data.textColor).toBe('#AbCdEf')
  })

  it('sanitizes link addresses again (javascript:/data: become empty)', () => {
    const raw = (url: string) => ({
      id: `l-${url.length}`,
      type: 'link',
      position: { x: 0, y: 0 },
      data: { url, title: 'x', description: '' },
    })
    const out = deserializeCanvas(stored([raw('javascript:alert(1)'), raw('data:text/html,<b>'), raw('example.com'), raw('https://a@b.com')]))
    const urls = out.nodes.map((n) => (n.type === 'link' ? n.data.url : null))
    expect(urls).toEqual(['', '', 'https://example.com/', ''])
  })

  it('drops image cards without an image id or valid natural size', () => {
    const img = (data: Record<string, unknown>, id: string) => ({ id, type: 'image', position: { x: 0, y: 0 }, width: 280, data })
    const out = deserializeCanvas(
      stored([
        img({ imageId: 'ok', naturalWidth: 10, naturalHeight: 5 }, 'good'),
        img({ naturalWidth: 10, naturalHeight: 5 }, 'no-id'),
        img({ imageId: 'x', naturalWidth: 0, naturalHeight: 5 }, 'zero'),
        img({ imageId: 'x', naturalWidth: 'a', naturalHeight: 5 }, 'nan'),
      ]),
    )
    expect(out.nodes.map((n) => n.id)).toEqual(['good'])
    expect(out.discardedCount).toBe(3)
  })

  it('clamps sizes and coordinates, and gives defaults to missing sizes', () => {
    const out = deserializeCanvas(
      stored([
        rawSticky({ width: 1, height: 10 ** 9, position: { x: 10 ** 12, y: -(10 ** 12) } }),
        rawSticky({ id: 's2', width: undefined, height: undefined }),
      ]),
    )
    const [a, b] = out.nodes
    expect(a?.width).toBe(160) // الحد الأدنى لعرض الورقة
    expect(a?.height).toBe(4000)
    expect(a?.position).toEqual({ x: 10_000_000, y: -10_000_000 })
    expect(b?.width).toBe(232)
    expect(b?.height).toBe(208)
  })

  it('keeps a valid parent and removes an invalid one; groups never become members', () => {
    const group = { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G' } }
    const out = deserializeCanvas(
      stored([
        rawSticky({ id: 'in', parentId: 'g' }),
        rawSticky({ id: 'ghost', parentId: 'missing' }),
        rawSticky({ id: 'not-a-group', parentId: 'in' }),
        { ...group, id: 'g2', parentId: 'g' },
        group,
      ]),
    )
    const parent = (id: string) => out.nodes.find((n) => n.id === id)?.parentId
    expect(parent('in')).toBe('g')
    expect(parent('ghost')).toBeUndefined()
    expect(parent('not-a-group')).toBeUndefined()
    expect(parent('g2')).toBeUndefined()
  })

  it('puts groups first and forces the title-bar drag handle', () => {
    const out = deserializeCanvas(stored([rawSticky(), { id: 'g', type: 'group', position: { x: 0, y: 0 }, dragHandle: '.evil', data: {} }]))
    expect(out.nodes.map((n) => n.id)).toEqual(['g', 's1'])
    expect(out.nodes[0]?.dragHandle).toBe('.group-drag-handle')
  })

  it('limits the number of nodes', () => {
    const many = Array.from({ length: MAX_NODES + 5 }, (_, i) => rawSticky({ id: `n${i}` }))
    const out = deserializeCanvas(stored(many))
    expect(out.nodes).toHaveLength(MAX_NODES)
    expect(out.discardedCount).toBe(5)
  })
})

describe('deserializeCanvas: edges', () => {
  const nodes = [rawSticky({ id: 'a' }), rawSticky({ id: 'b' }), { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: {} }]
  const edge = (over: Record<string, unknown>) => ({ id: 'e1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', data: {}, ...over })

  it('keeps a valid edge and fills missing style with defaults', () => {
    const out = deserializeCanvas(stored(nodes, [edge({})]))
    expect(out.edges).toHaveLength(1)
    expect(out.edges[0]?.data).toEqual({ curve: 'curved', lineStyle: 'solid', arrow: 'end', color: 'gradient', label: '' })
  })

  it('drops edges with missing endpoints, self loops, group endpoints, duplicate ids or duplicate pairs', () => {
    const out = deserializeCanvas(
      stored(nodes, [
        edge({}),
        edge({ id: 'e2', target: 'missing' }),
        edge({ id: 'e3', target: 'a' }),
        edge({ id: 'e4', target: 'g' }),
        edge({ id: 'e1', source: 'b', target: 'a' }),
        edge({ id: 'e5' }),
        null,
      ]),
    )
    expect(out.edges.map((e) => e.id)).toEqual(['e1'])
    // المحذوفة: هدف مفقود، حلقة ذاتية، طرف مجموعة، معرّف مكرر، زوج مكرر، عنصر ليس كائناً
    expect(out.discardedCount).toBe(6)
  })

  it('replaces unknown handles and style values with safe ones', () => {
    const out = deserializeCanvas(stored(nodes, [edge({ sourceHandle: 'bogus', targetHandle: 5, data: { curve: 'zigzag', color: 'neon', label: 'y'.repeat(500) } })]))
    const e = out.edges[0]
    expect([e?.sourceHandle, e?.targetHandle]).toEqual(['right', 'left'])
    expect(e?.data?.curve).toBe('curved')
    expect(e?.data?.color).toBe('gradient')
    expect(e?.data?.label).toHaveLength(60)
  })

  it('drops the edge when its node was discarded', () => {
    const out = deserializeCanvas(stored([rawSticky({ id: 'a' }), rawSticky({ id: 'b', position: { x: NaN, y: 0 } })], [edge({})]))
    expect(out.edges).toHaveLength(0)
    expect(out.discardedCount).toBe(2)
  })
})

describe('deserializeCanvas: viewport', () => {
  it('clamps zoom and coordinates', () => {
    const out = deserializeCanvas(stored([], [], { x: 10 ** 12, y: -(10 ** 12), zoom: 500 }))
    expect(out.viewport.x).toBe(10_000_000)
    expect(out.viewport.y).toBe(-10_000_000)
    expect(out.viewport.zoom).toBe(3)
  })
})

describe('collectImageIds', () => {
  it('collects image ids from stored nodes and tolerates junk', () => {
    const ids = collectImageIds(
      stored([
        { type: 'image', data: { imageId: 'a' } },
        { type: 'image', data: { imageId: 'b' } },
        { type: 'image', data: {} },
        { type: 'sticky', data: { imageId: 'c' } },
        null,
        'x',
      ]),
    )
    expect([...ids].sort()).toEqual(['a', 'b'])
  })
})

describe('card status and lock (schema v2)', () => {
  it('reads a version 1 canvas unchanged: no status, not locked, no lock flags', () => {
    const out = deserializeCanvas(stored([rawSticky()]))
    const [node] = out.nodes
    expect(out.discardedCount).toBe(0)
    expect(node?.data.status).toBeUndefined()
    expect(node?.data.locked).toBeUndefined()
    expect(node?.draggable).toBeUndefined()
    expect(node?.deletable).toBeUndefined()
  })

  it('round-trips status and lock, and a locked card comes back immovable and undeletable', () => {
    const node = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'a' }
    const locked = { ...node, data: { ...node.data, status: 'done' as const, locked: true }, draggable: false, deletable: false }
    const out = deserializeCanvas(serializeCanvas([locked], [], viewport))
    expect(out.nodes).toEqual([locked])
    expect(out.nodes[0]?.draggable).toBe(false)
    expect(out.nodes[0]?.deletable).toBe(false)
  })

  it('derives the lock flags from data.locked even if the stored file claims otherwise', () => {
    const raw = rawSticky({ draggable: true, data: { ...rawSticky().data, locked: true } })
    const [node] = deserializeCanvas(stored([raw])).nodes
    expect(node?.draggable).toBe(false)
    expect(node?.deletable).toBe(false)
  })

  it('does not store default values', () => {
    const node = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'a' }
    const json = JSON.stringify(serializeCanvas([node], [], viewport))
    expect(json).not.toContain('status')
    expect(json).not.toContain('locked')
  })

  it('treats hostile status and lock values as defaults', () => {
    const data = { ...rawSticky().data, status: 'weird', locked: 'yes' }
    const [node] = deserializeCanvas(stored([rawSticky({ data })])).nodes
    expect(node?.data.status).toBeUndefined()
    expect(node?.data.locked).toBeUndefined()
    const [numeric] = deserializeCanvas(stored([rawSticky({ data: { ...rawSticky().data, status: 7, locked: 1 } })])).nodes
    expect(numeric?.data.status).toBeUndefined()
    expect(numeric?.data.locked).toBeUndefined()
  })

  it('ignores a status stored on a group (groups have none) but keeps its lock', () => {
    const group = { id: 'g', type: 'group', position: { x: 0, y: 0 }, width: 520, height: 360, data: { label: 'G', color: 'blue', tags: [], createdAt: 1, updatedAt: 1, status: 'done', locked: true } }
    const [node] = deserializeCanvas(stored([group])).nodes
    expect(node?.type).toBe('group')
    expect(node?.data.status).toBeUndefined()
    expect(node?.data.locked).toBe(true)
    expect(node?.draggable).toBe(false)
  })

  it('accepts the new sticky colors and falls back for unknown ones', () => {
    const colors = ['orange', 'red', 'nope'].map((color, i) => rawSticky({ id: `s${i}`, data: { ...rawSticky().data, color } }))
    const out = deserializeCanvas(stored(colors)).nodes.map((n) => (n.type === 'sticky' ? n.data.color : null))
    expect(out).toEqual(['orange', 'red', 'yellow'])
  })
})

describe('image appearance', () => {
  const rawImage = (appearance?: unknown) => ({
    id: 'i1',
    type: 'image',
    position: { x: 0, y: 0 },
    width: 280,
    data: { imageId: 'img-1', title: '', description: '', fileName: 'a.png', naturalWidth: 800, naturalHeight: 400, tags: [], createdAt: 1, updatedAt: 1, ...(appearance === undefined ? {} : { appearance }) },
  })
  const appearanceOf = (value?: unknown) => {
    const [node] = deserializeCanvas(stored([rawImage(value)])).nodes
    return node?.type === 'image' ? node.data.appearance : 'not-an-image'
  }

  it('keeps sticker and cover, and leaves the default unset', () => {
    expect(appearanceOf('frameless')).toBe('frameless')
    expect(appearanceOf('cover')).toBe('cover')
    expect(appearanceOf()).toBeUndefined()
    expect(appearanceOf('card')).toBeUndefined()
  })

  it('falls back to the default for hostile values', () => {
    for (const value of ['wide', 7, null, {}, ['cover']]) expect(appearanceOf(value)).toBeUndefined()
  })

  it('does not write an unset appearance back to storage', () => {
    const [node] = deserializeCanvas(stored([rawImage()])).nodes
    expect(JSON.stringify(serializeCanvas(node ? [node] : [], [], viewport))).not.toContain('appearance')
  })
})

describe('checklist cards', () => {
  const rawChecklist = (data: Record<string, unknown> = {}) => ({
    id: 'c1',
    type: 'checklist',
    position: { x: 0, y: 0 },
    width: 280,
    height: 250,
    data: { title: 'Todo', items: [{ id: 'a', text: 'one', done: true }, { id: 'b', text: 'two', done: false }], tags: [], createdAt: 1, updatedAt: 1, ...data },
  })
  const itemsOf = (data?: Record<string, unknown>) => {
    const [node] = deserializeCanvas(stored([rawChecklist(data)])).nodes
    return node?.type === 'checklist' ? node.data.items : null
  }

  it('round-trips a checklist exactly', () => {
    const [node] = deserializeCanvas(stored([rawChecklist()])).nodes
    const again = deserializeCanvas(serializeCanvas(node ? [node] : [], [], viewport)).nodes
    expect(again).toEqual([node])
    expect(itemsOf()).toEqual([{ id: 'a', text: 'one', done: true }, { id: 'b', text: 'two', done: false }])
  })

  it('survives a missing or wrongly typed items field', () => {
    for (const items of [undefined, null, 'x', 7, {}]) expect(itemsOf({ items })).toEqual([])
  })

  it('drops non-object and empty items, coerces done, and repairs bad or duplicate ids', () => {
    const items = itemsOf({ items: [null, 'x', { id: 'a', text: '   ' }, { id: 'a', text: 'kept', done: 'yes' }, { id: 'a', text: 'dup', done: true }, { text: 'noid' }, { id: 5, text: 'numeric id' }] })
    expect(items?.map((i) => i.text)).toEqual(['kept', 'dup', 'noid', 'numeric id'])
    expect(items?.map((i) => i.done)).toEqual([false, true, false, false])
    expect(new Set(items?.map((i) => i.id)).size).toBe(4)
  })

  it('enforces the item count and text length limits', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `i${i}`, text: 'x'.repeat(1000) }))
    const items = itemsOf({ items: many })
    expect(items).toHaveLength(40)
    expect(items?.every((i) => i.text.length <= 160)).toBe(true)
  })
})

describe('shape cards', () => {
  const rawShape = (data: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
    id: 'sh1',
    type: 'shape',
    position: { x: 0, y: 0 },
    width: 200,
    height: 140,
    data: { shape: 'diamond', label: 'Decide', color: 'orange', tags: [], createdAt: 1, updatedAt: 1, ...data },
    ...over,
  })
  const shapeOf = (data?: Record<string, unknown>, over?: Record<string, unknown>) => {
    const [node] = deserializeCanvas(stored([rawShape(data, over)])).nodes
    return node?.type === 'shape' ? node : null
  }

  it('round-trips every shape kind with its text and color', () => {
    for (const shape of ['rectangle', 'ellipse', 'diamond']) {
      const node = shapeOf({ shape })
      expect(node?.data).toMatchObject({ shape, label: 'Decide', color: 'orange' })
      const again = deserializeCanvas(serializeCanvas(node ? [node] : [], [], viewport)).nodes
      expect(again).toEqual([node])
    }
  })

  it('falls back to a rectangle, neutral-safe color and empty label for hostile values', () => {
    const node = shapeOf({ shape: 'star', color: 'nope', label: 42 })
    expect(node?.data.shape).toBe('rectangle')
    expect(node?.data.color).toBe('yellow')
    expect(node?.data.label).toBe('')
  })

  it('clamps a tiny or huge size to the resize limits', () => {
    const tiny = shapeOf({}, { width: 1, height: 1 })
    expect(tiny?.width).toBeGreaterThanOrEqual(90)
    expect(tiny?.height).toBeGreaterThanOrEqual(60)
  })
})

describe('video cards', () => {
  const ID = 'dQw4w9WgXcQ'
  const rawVideo = (data: Record<string, unknown> = {}) => ({
    id: 'v1',
    type: 'video',
    position: { x: 0, y: 0 },
    width: 360,
    height: 260,
    data: { url: `https://www.youtube.com/watch?v=${ID}`, title: 'Talk', tags: [], createdAt: 1, updatedAt: 1, ...data },
  })
  const urlOf = (data?: Record<string, unknown>) => {
    const [node] = deserializeCanvas(stored([rawVideo(data)])).nodes
    return node?.type === 'video' ? node.data.url : 'not-a-video'
  }

  it('round-trips a video card', () => {
    const [node] = deserializeCanvas(stored([rawVideo()])).nodes
    expect(deserializeCanvas(serializeCanvas(node ? [node] : [], [], viewport)).nodes).toEqual([node])
    expect(urlOf()).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('rebuilds the canonical address from the video id, dropping other parameters', () => {
    expect(urlOf({ url: `https://youtu.be/${ID}?si=track&t=9` })).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('turns anything that is not a valid YouTube link into an empty card, never keeping the text', () => {
    for (const url of ['javascript:alert(1)', 'https://evil.com/watch?v=dQw4w9WgXcQ', `https://youtube.com.evil.com/watch?v=${ID}`, '"><script>alert(1)</script>', 42, null, undefined, {}]) {
      expect(urlOf({ url })).toBe('')
    }
  })

  it('accepts an empty video card (the state right after creating one)', () => {
    expect(urlOf({ url: '' })).toBe('')
  })
})
