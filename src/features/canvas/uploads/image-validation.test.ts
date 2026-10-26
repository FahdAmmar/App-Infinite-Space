import { describe, expect, it } from 'vitest'
import { IMAGE_LIMITS } from '../utils/constants'
import { fitImageWidth, IMAGE_ACCEPT_ATTRIBUTE, validateImageFile, validatePixelCount } from './image-validation'

const file = (overrides: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'photo.png',
  type: 'image/png',
  size: 1024,
  ...overrides,
})

describe('validateImageFile', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])('accepts %s', (type) => {
    expect(validateImageFile(file({ type }))).toEqual({ ok: true })
  })

  it.each(['image/svg+xml', 'application/pdf', 'text/html', 'application/octet-stream', ''])(
    'rejects %s (SVG can carry scripts, the rest are not images)',
    (type) => {
      const result = validateImageFile(file({ type }))
      expect(result.ok).toBe(false)
    },
  )

  it('rejects empty files', () => {
    expect(validateImageFile(file({ size: 0 }))).toMatchObject({ ok: false })
  })

  it('accepts a file exactly at the limit and rejects one byte over', () => {
    expect(validateImageFile(file({ size: IMAGE_LIMITS.maxBytes }))).toEqual({ ok: true })
    const over = validateImageFile(file({ size: IMAGE_LIMITS.maxBytes + 1, name: 'big.png' }))
    expect(over.ok === false && over.message).toContain('big.png')
  })

  it('exposes the accepted types for the file picker', () => {
    expect(IMAGE_ACCEPT_ATTRIBUTE).toBe('image/png,image/jpeg,image/webp,image/gif,image/avif')
  })
})

describe('validatePixelCount', () => {
  it('accepts normal sizes', () => {
    expect(validatePixelCount('a.png', 4000, 3000)).toEqual({ ok: true })
  })

  it('rejects images with too many pixels (decompression bombs)', () => {
    expect(validatePixelCount('huge.png', 20000, 20000)).toMatchObject({ ok: false })
  })

  it('rejects zero-sized images', () => {
    expect(validatePixelCount('empty.png', 0, 10)).toMatchObject({ ok: false })
  })
})

describe('fitImageWidth', () => {
  it('uses the default width for ordinary images', () => {
    expect(fitImageWidth(1600, 900)).toBe(IMAGE_LIMITS.defaultWidth)
  })

  it('narrows tall images so the initial height stays within the limit', () => {
    const width = fitImageWidth(500, 2000) // نسبة 4:1 → العرض الأقصى = 420 / 4 = 105 → يُرفع للحد الأدنى
    expect(width).toBe(IMAGE_LIMITS.minWidth)
    const tallish = fitImageWidth(1000, 2000) // العرض = 420 / 2 = 210
    expect(tallish).toBe(210)
  })

  it('never goes below the minimum width', () => {
    expect(fitImageWidth(10, 100000)).toBe(IMAGE_LIMITS.minWidth)
  })
})
