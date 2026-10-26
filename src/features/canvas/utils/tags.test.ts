import { describe, expect, it } from 'vitest'
import { MAX_TAGS, TAG_MAX_LENGTH } from './constants'
import { addTag, normalizeTag, removeTag } from './tags'

describe('normalizeTag', () => {
  it('strips #, commas and surrounding space, and joins words with a dash', () => {
    expect(normalizeTag('  #psychology  ')).toBe('psychology')
    expect(normalizeTag('deep   work')).toBe('deep-work')
    expect(normalizeTag('a,b،c')).toBe('abc')
  })

  it('keeps non-Latin letters (Arabic tags are valid)', () => {
    expect(normalizeTag('#علم النفس')).toBe('علم-النفس')
  })

  it('removes control characters and truncates to the maximum length', () => {
    expect(normalizeTag('a\u0000b\u001fc')).toBe('abc')
    expect(normalizeTag('x'.repeat(TAG_MAX_LENGTH + 10))).toHaveLength(TAG_MAX_LENGTH)
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeTag('   ')).toBe('')
    expect(normalizeTag('#')).toBe('')
  })
})

describe('addTag / removeTag', () => {
  it('adds a normalized tag', () => {
    expect(addTag(['a'], ' #b ')).toEqual(['a', 'b'])
  })

  it('ignores blank and duplicate tags (case-insensitive)', () => {
    expect(addTag(['Work'], 'work')).toEqual(['Work'])
    expect(addTag(['a'], '  ')).toEqual(['a'])
  })

  it('stops at the maximum number of tags', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(addTag(full, 'extra')).toEqual(full)
  })

  it('does not mutate its input', () => {
    const tags = ['a']
    addTag(tags, 'b')
    removeTag(tags, 'a')
    expect(tags).toEqual(['a'])
  })

  it('removes a tag', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b'])
  })
})
