import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('merges conflicting Tailwind utilities (the last one wins)', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  // انحدار: tailwind-merge كان يحذف الصنف المخصص text-card أمام text-ink لأنه يبدأ بـ "text-"
  // فيعدّه لون نص؛ فاختفى إطار بطاقة النص وخلفيتها دون أي خطأ. أصناف مكوّناتنا المخصصة يجب ألا تُحذف.
  it.each(['card-node', 'sticky-note', 'sticky-note-selected', 'card-node-selected', 'ws-chip', 'ws-preview', 'ws-ink', 'dot-grid', 'canvas-root'])(
    'keeps the custom component class "%s" next to typical utilities',
    (customClass) => {
      const merged = cn(customClass, 'flex h-full text-left text-ink bg-surface border-line shadow-card')
      expect(merged.split(' ')).toContain(customClass)
    },
  )

  it('documents the pitfall: a custom class starting with "text-" IS dropped', () => {
    expect(cn('text-card', 'text-ink').split(' ')).not.toContain('text-card')
  })
})
