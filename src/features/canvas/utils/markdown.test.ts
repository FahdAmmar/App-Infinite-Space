import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown'

const text = (value: string) => ({ kind: 'text', text: value })

describe('parseMarkdown: blocks', () => {
  it('keeps plain text as one paragraph with its line breaks', () => {
    expect(parseMarkdown('first line\nsecond line')).toEqual([{ kind: 'paragraph', inline: [text('first line\nsecond line')] }])
  })

  it('separates paragraphs by blank lines', () => {
    const blocks = parseMarkdown('one\n\ntwo')
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph'])
  })

  it('reads headings of level 1 to 3; deeper or marker-less lines are paragraphs', () => {
    expect(parseMarkdown('# A\n## B\n### C').map((b) => (b.kind === 'heading' ? b.level : 0))).toEqual([1, 2, 3])
    expect(parseMarkdown('#### D')[0]?.kind).toBe('paragraph')
    expect(parseMarkdown('#tag')[0]?.kind).toBe('paragraph')
  })

  it('reads bullet and numbered lists as separate lists', () => {
    const blocks = parseMarkdown('- a\n- b\n1. c\n2) d')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false })
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: true })
    expect(blocks[0]?.kind === 'list' && blocks[0].items).toHaveLength(2)
  })

  it('reads task items with their state', () => {
    const [block] = parseMarkdown('- [ ] open\n- [x] done\n- [X] also done\n- plain')
    expect(block?.kind === 'list' && block.items.map((i) => i.task)).toEqual(['open', 'done', 'done', null])
  })

  it('merges consecutive quote lines', () => {
    const blocks = parseMarkdown('> a\n> b')
    expect(blocks).toEqual([{ kind: 'quote', inline: [text('a\nb')] }])
  })

  it('ends a list when a paragraph line follows', () => {
    expect(parseMarkdown('- a\ntext').map((b) => b.kind)).toEqual(['list', 'paragraph'])
  })

  it('handles CRLF and an empty string', () => {
    expect(parseMarkdown('a\r\nb')).toEqual([{ kind: 'paragraph', inline: [text('a\nb')] }])
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('   \n  ')).toEqual([])
  })

  it('works with Arabic text and Arabic content in lists', () => {
    const [block] = parseMarkdown('- **مهم** أولاً\n- ثانياً')
    expect(block?.kind === 'list' && block.items[0]?.inline[0]).toEqual({ kind: 'bold', children: [text('مهم')] })
  })
})

describe('parseInline', () => {
  it('reads bold, italic and code', () => {
    expect(parseInline('a **b** *c* _d_ `e`')).toEqual([
      text('a '),
      { kind: 'bold', children: [text('b')] },
      text(' '),
      { kind: 'italic', children: [text('c')] },
      text(' '),
      { kind: 'italic', children: [text('d')] },
      text(' '),
      { kind: 'code', text: 'e' },
    ])
  })

  it('does not treat snake_case or spaced stars as emphasis', () => {
    expect(parseInline('snake_case_name')).toEqual([text('snake_case_name')])
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')])
  })

  it('leaves unclosed markers as text', () => {
    expect(parseInline('**oops')).toEqual([text('**oops')])
    expect(parseInline('`oops')).toEqual([text('`oops')])
    expect(parseInline('[a](https://x.com')).toEqual([text('[a](https://x.com')])
  })

  it('does not parse markers inside code', () => {
    expect(parseInline('`**x**`')).toEqual([{ kind: 'code', text: '**x**' }])
  })

  it('reads http and https links, with formatted labels', () => {
    expect(parseInline('[site](https://example.com/a)')).toEqual([{ kind: 'link', href: 'https://example.com/a', children: [text('site')] }])
    expect(parseInline('[**b**](http://example.com)')[0]).toMatchObject({ kind: 'link', children: [{ kind: 'bold' }] })
  })

  it('keeps dangerous or ambiguous link targets as plain text', () => {
    for (const target of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'ftp://x.com', 'example.com', '//evil.com', 'https://user:pw@evil.com']) {
      const out = parseInline(`[click](${target})`)
      expect(out.some((n) => n.kind === 'link')).toBe(false)
    }
  })

  it('never produces HTML: tags stay text', () => {
    const out = parseInline('<script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect(out).toEqual([text('<script>alert(1)</script> <img src=x onerror=alert(1)>')])
  })

  it('limits nesting depth', () => {
    const deep = '*'.repeat(1) + '**a **b **c **d** c** b** a**' + '*'
    expect(() => parseInline(deep)).not.toThrow()
  })

  it('stays fast on hostile long input', () => {
    const inputs = ['*'.repeat(5000), '['.repeat(5000), '`'.repeat(5000), '_a'.repeat(2500), '**a'.repeat(1700), '[a](https://x.com'.repeat(300)]
    const started = performance.now()
    for (const input of inputs) parseMarkdown(input)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})
