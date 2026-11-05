import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { createEdge } from './edge-utils'
import { createGroup, createStickyNote } from './node-factory'
import { createSnippet, MAX_SNIPPET_BYTES, MAX_SNIPPETS, sanitizeSnippets, snippetName, snippetToClipboard } from './snippets'

const sticky = (id: string, y: number, title: string, selected = true): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, selected, position: { x: 0, y }, data: { ...node.data, title } }
}
const image = (id: string, selected = true): CanvasNode => ({
  id,
  type: 'image',
  selected,
  position: { x: 0, y: 0 },
  width: 200,
  height: 150,
  data: { createdAt: 1, updatedAt: 1, tags: [], imageId: 'img', title: '', description: '', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10 },
})
const edge = (a: string, b: string): CanvasEdge => ({ ...createEdge(a, b, 'right', 'left'), id: `${a}-${b}` })

describe('snippetName', () => {
  it('uses the first card in reading order and counts the others', () => {
    expect(snippetName([sticky('b', 200, 'Second'), sticky('a', 0, 'First')])).toBe('First + 1')
    expect(snippetName([sticky('a', 0, 'Only')])).toBe('Only')
  })
})

describe('createSnippet', () => {
  it('saves the selection with the connections between its cards', () => {
    const result = createSnippet([sticky('a', 0, 'A'), sticky('b', 100, 'B'), sticky('c', 200, 'C', false)], [edge('a', 'b'), edge('b', 'c')], 'id1', 5)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snippet).toMatchObject({ id: 'id1', createdAt: 5, name: 'A + 1' })
    expect(result.snippet.canvas.nodes).toHaveLength(2)
    expect(result.snippet.canvas.edges).toHaveLength(1) // only the connection inside the selection
  })

  it('leaves image cards out and says how many', () => {
    const result = createSnippet([sticky('a', 0, 'A'), image('i')], [edge('a', 'i')], 'id', 1)
    expect(result.ok && result.skippedImages).toBe(1)
    expect(result.ok && result.snippet.canvas.edges).toHaveLength(0)
  })

  it('reports why nothing was saved', () => {
    expect(createSnippet([sticky('a', 0, 'A', false)], [], 'id', 1)).toEqual({ ok: false, reason: 'nothing-selected' })
    expect(createSnippet([image('i')], [], 'id', 1)).toEqual({ ok: false, reason: 'only-images' })
    const huge = sticky('h', 0, 'x'.repeat(MAX_SNIPPET_BYTES))
    expect(createSnippet([huge], [], 'id', 1)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('keeps a selected group with its members', () => {
    const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', selected: true }
    const member: CanvasNode = { ...sticky('m', 10, 'Inside', false), parentId: 'g' }
    const result = createSnippet([group, member], [], 'id', 1)
    expect(result.ok && result.snippet.canvas.nodes).toHaveLength(2)
  })

  it('stores no selection state', () => {
    const result = createSnippet([sticky('a', 0, 'A')], [], 'id', 1)
    expect(JSON.stringify(result.ok && result.snippet.canvas)).not.toContain('"selected":true')
  })
})

describe('snippetToClipboard', () => {
  it('turns a saved snippet back into cards and connections', () => {
    const result = createSnippet([sticky('a', 0, 'A'), sticky('b', 100, 'B')], [edge('a', 'b')], 'id', 1)
    if (!result.ok) throw new Error('expected a snippet')
    const clip = snippetToClipboard(result.snippet, 2)
    expect(clip?.nodes.map((node) => node.id).sort()).toEqual(['a', 'b'])
    expect(clip?.edges).toHaveLength(1)
  })
})

describe('sanitizeSnippets (untrusted storage)', () => {
  const good = () => {
    const result = createSnippet([sticky('a', 0, 'A')], [], 'ok', 1)
    if (!result.ok) throw new Error('expected a snippet')
    return result.snippet
  }

  it('accepts what it saved', () => {
    expect(sanitizeSnippets([good()], 9).map((snippet) => snippet.id)).toEqual(['ok'])
  })

  it('drops damaged entries one by one without losing the good ones', () => {
    const raw = [null, 'x', 5, { id: '' }, { id: 'a' }, { id: 'b', canvas: { nodes: 'no', edges: [] } }, { id: 'c', canvas: { nodes: [], edges: [] } }, good()]
    expect(sanitizeSnippets(raw, 9).map((snippet) => snippet.id)).toEqual(['ok'])
  })

  it('returns nothing for a non-array', () => {
    expect(sanitizeSnippets({ a: 1 }, 9)).toEqual([])
    expect(sanitizeSnippets(undefined, 9)).toEqual([])
  })

  it('removes duplicate ids and image cards smuggled into storage', () => {
    const withImage = { ...good(), id: 'img' }
    withImage.canvas = { ...withImage.canvas, nodes: [...withImage.canvas.nodes, image('i') as unknown] }
    const cleaned = sanitizeSnippets([good(), good(), withImage], 9)
    expect(cleaned.map((snippet) => snippet.id)).toEqual(['ok', 'img'])
    expect(cleaned[1]?.canvas.nodes).toHaveLength(1)
  })

  it('cleans the text, caps the name and respects the count limit', () => {
    const long = { ...good(), name: 'n'.repeat(500) }
    expect(sanitizeSnippets([long], 9)[0]?.name.length).toBe(80)
    const many = Array.from({ length: MAX_SNIPPETS + 10 }, (_, i) => ({ ...good(), id: `s${i}` }))
    expect(sanitizeSnippets(many, 9)).toHaveLength(MAX_SNIPPETS)
  })
})
