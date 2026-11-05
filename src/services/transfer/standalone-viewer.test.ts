import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createEdge } from '@/features/canvas/utils/edge-utils'
import { createGroup, createLinkCard, createStickyNote } from '@/features/canvas/utils/node-factory'
import { buildViewerData, buildViewerHtml, escapeHtml, escapeJsonForScript } from './standalone-viewer'

const sticky = (id: string, title: string, content = ''): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, position: { x: 100, y: 50 }, data: { ...node.data, title, content } }
}

const payload = (html: string): unknown => {
  const match = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)
  return JSON.parse(match?.[1] ?? 'null')
}

describe('escapeJsonForScript', () => {
  it('cannot be closed early by a script end tag or an HTML comment', () => {
    const text = escapeJsonForScript({ note: '</script><script>alert(1)</script><!-- x -->' })
    expect(text).not.toContain('</script')
    expect(text).not.toContain('<!--')
    expect(text).not.toContain('<')
  })

  it('round-trips the original text exactly', () => {
    const original = { a: '</script> & <b> "quotes" \u2028 \u2029 أفكار 😀', n: [1, 2] }
    expect(JSON.parse(escapeJsonForScript(original))).toEqual(original)
  })
})

describe('escapeHtml', () => {
  it('escapes the characters that matter in text and attributes', () => {
    expect(escapeHtml(`<img src=x onerror="a&b">`)).toBe('&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;')
  })
})

describe('buildViewerData', () => {
  it('uses absolute positions for cards inside a group and draws groups first', () => {
    const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 1000, y: 500 } }
    const member: CanvasNode = { ...sticky('m', 'Inside'), parentId: 'g', position: { x: 20, y: 30 } }
    const data = buildViewerData({ name: 'W', description: '', nodes: [member, group], edges: [], images: {}, exportedAt: 0 })
    expect(data.nodes.map((node) => node.id)).toEqual(['g', 'm'])
    expect(data.nodes[1]).toMatchObject({ x: 1020, y: 530 })
  })

  it('keeps only web links and drops anything else', () => {
    const link = createLinkCard({ x: 0, y: 0 }, 1)
    const make = (url: string): CanvasNode => ({ ...link, id: url, data: { ...link.data, url } })
    const data = buildViewerData({
      name: 'W',
      description: '',
      nodes: [make('https://example.com'), make('javascript:alert(1)'), make('data:text/html,x')],
      edges: [],
      images: {},
      exportedAt: 0,
    })
    expect(data.nodes.map((node) => node.url)).toEqual(['https://example.com', '', ''])
  })

  it('embeds only raster data URIs for images', () => {
    const image: CanvasNode = {
      id: 'i',
      type: 'image',
      position: { x: 0, y: 0 },
      width: 200,
      height: 150,
      data: { createdAt: 1, updatedAt: 1, tags: [], imageId: 'img1', title: '', description: '', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10 },
    }
    const ok = buildViewerData({ name: 'W', description: '', nodes: [image], edges: [], images: { img1: 'data:image/png;base64,AAAA' }, exportedAt: 0 })
    expect(ok.nodes[0]?.image).toBe('data:image/png;base64,AAAA')
    for (const bad of ['data:image/svg+xml;base64,AAAA', 'https://evil.example/x.png', 'data:image/png;base64,AA"onerror=1', 'data:text/html;base64,AAAA']) {
      expect(buildViewerData({ name: 'W', description: '', nodes: [image], edges: [], images: { img1: bad }, exportedAt: 0 }).nodes[0]?.image).toBeNull()
    }
  })

  it('drops connections whose cards are missing and keeps the handle sides and style', () => {
    const edges: CanvasEdge[] = [
      { ...createEdge('a', 'b', 'bottom', 'top', { label: 'feeds', curve: 'step' }), id: 'e1' },
      { ...createEdge('a', 'gone', 'right', 'left'), id: 'e2' },
    ]
    const data = buildViewerData({ name: 'W', description: '', nodes: [sticky('a', 'A'), sticky('b', 'B')], edges, images: {}, exportedAt: 0 })
    expect(data.edges).toHaveLength(1)
    expect(data.edges[0]).toMatchObject({ from: 'a', to: 'b', fromSide: 'bottom', toSide: 'top', label: 'feeds', curve: 'step' })
  })
})

describe('buildViewerHtml', () => {
  const hostile = '</script><img src=x onerror=alert(1)>'
  const html = buildViewerHtml(
    buildViewerData({ name: hostile, description: '', nodes: [sticky('a', hostile, hostile)], edges: [], images: {}, exportedAt: Date.UTC(2026, 10, 1) }),
  )

  it('is a complete page that forbids network access', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("img-src data:")
    expect(html).not.toMatch(/connect-src|https?:\/\/(?!www\.w3\.org)[^"' ]*\.(js|css)/)
  })

  it('never lets user text become markup', () => {
    expect(html).not.toContain('<img src=x')
    expect(html.match(/<script/g)).toHaveLength(2) // data + viewer only
    expect(html).toContain('&lt;/script&gt;&lt;img') // the title, escaped
  })

  it('carries the workspace data intact', () => {
    const data = payload(html) as { name: string; nodes: { title: string; text: string }[] }
    expect(data.name).toBe(hostile)
    expect(data.nodes[0]).toMatchObject({ title: hostile, text: hostile })
  })

  it('builds the DOM with text nodes only', () => {
    expect(html).not.toContain('innerHTML')
    expect(html).not.toContain('document.write')
  })

  it('shows the export date', () => {
    expect(html).toContain('exported 2026-11-01')
  })
})
