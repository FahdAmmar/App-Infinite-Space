import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { CONTENT_MAX_LENGTH, NODE_SIZES } from './constants'
import { MAX_PASTE_CARDS, planTextPaste } from './text-paste'

const plan = (text: string) => planTextPaste(text, { x: 0, y: 0 }, 1)
const centerOf = (node: CanvasNode) => ({
  x: node.position.x + (node.width ?? 0) / 2,
  y: node.position.y + (node.height ?? 0) / 2,
})

describe('planTextPaste: links', () => {
  it('turns a pasted web address into a link card with the normalized address', () => {
    const { nodes } = plan('  https://example.com/a?b=1  ')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'link', data: { url: 'https://example.com/a?b=1' } })
  })

  it('accepts a www. address and adds https', () => {
    expect(plan('www.example.com/page').nodes[0]).toMatchObject({ type: 'link', data: { url: 'https://www.example.com/page' } })
  })

  it('does not turn a plain word or a bare domain into a link', () => {
    expect(plan('hello').nodes[0]).toMatchObject({ type: 'sticky', data: { content: 'hello' } })
    expect(plan('example.com').nodes[0]?.type).toBe('sticky')
  })

  it('never makes a link from dangerous or credentialed addresses; the text stays visible', () => {
    expect(plan('javascript:alert(1)').nodes[0]).toMatchObject({ type: 'sticky', data: { content: 'javascript:alert(1)' } })
    expect(plan('https://bank.com@evil.com/login').nodes[0]?.type).toBe('sticky')
    expect(plan('data:text/html,<script>1</script>').nodes[0]?.type).toBe('sticky')
  })

  it('keeps an address inside a longer line as text', () => {
    expect(plan('see https://example.com for details').nodes[0]?.type).toBe('sticky')
  })
})

describe('planTextPaste: paragraphs', () => {
  it('keeps consecutive lines together as one card', () => {
    const { nodes } = plan('Groceries\nmilk\neggs')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ data: { content: 'Groceries\nmilk\neggs' } })
  })

  it('makes one card per paragraph separated by a blank line, handling Windows line endings', () => {
    const { nodes } = plan('First idea\r\n\r\nSecond idea\r\n \r\nhttps://example.com')
    expect(nodes.map((node) => node.type)).toEqual(['sticky', 'sticky', 'link'])
    expect(nodes[1]).toMatchObject({ data: { content: 'Second idea' } })
  })

  it('returns nothing for empty or whitespace-only text', () => {
    expect(plan('').nodes).toEqual([])
    expect(plan(' \n\n \t ').nodes).toEqual([])
  })

  it('keeps Arabic and other non-Latin text intact', () => {
    const arabic = 'فكرة أولى\nتفاصيل'
    expect(plan(arabic).nodes[0]).toMatchObject({ data: { content: arabic } })
  })

  it('uses a wider text card for a long paragraph and a sticky for a short one', () => {
    expect(plan('x'.repeat(280)).nodes[0]?.type).toBe('sticky')
    expect(plan('x'.repeat(281)).nodes[0]?.type).toBe('text')
  })
})

describe('planTextPaste: limits and layout', () => {
  it('stops at the card limit and reports how many paragraphs were left out', () => {
    const text = Array.from({ length: MAX_PASTE_CARDS + 5 }, (_, i) => `idea ${i}`).join('\n\n')
    const result = plan(text)
    expect(result.nodes).toHaveLength(MAX_PASTE_CARDS)
    expect(result.skippedParagraphs).toBe(5)
  })

  it('cuts a paragraph at the maximum content length and counts it', () => {
    const result = plan('y'.repeat(CONTENT_MAX_LENGTH + 10))
    expect(result.truncatedCards).toBe(1)
    expect((result.nodes[0] as { data: { content: string } }).data.content).toHaveLength(CONTENT_MAX_LENGTH)
  })

  it('lays cards on a grid centered on the paste point without overlaps', () => {
    const { nodes } = planTextPaste('a\n\nb\n\nc\n\nd', { x: 1000, y: 500 }, 1)
    const centers = nodes.map(centerOf)
    expect(centers.reduce((sum, c) => sum + c.x, 0) / 4).toBeCloseTo(1000, 5)
    expect(centers.reduce((sum, c) => sum + c.y, 0) / 4).toBeCloseTo(500, 5)
    const stickyW = NODE_SIZES.sticky.width
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const apart = Math.abs(centers[i]!.x - centers[j]!.x) >= stickyW || Math.abs(centers[i]!.y - centers[j]!.y) >= NODE_SIZES.sticky.height
        expect(apart).toBe(true)
      }
    }
  })

  it('handles a huge paste quickly without creating more than the limit', () => {
    const started = Date.now()
    const result = plan(Array.from({ length: 200_000 }, (_, i) => `line ${i}`).join('\n\n'))
    expect(result.nodes.length).toBeLessThanOrEqual(MAX_PASTE_CARDS)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('gives every card its own id', () => {
    const ids = plan('a\n\nb\n\nc').nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(3)
  })
})
