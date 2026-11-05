import { describe, expect, it } from 'vitest'
import { isAnimatedImage, MAX_STORED_SIDE, MIN_BYTES_TO_COMPRESS, planImageCompression, shouldUseCompressed } from './image-compress-plan'

const image = (over: Partial<Parameters<typeof planImageCompression>[0]> = {}) => ({
  type: 'image/jpeg',
  size: 2_000_000,
  width: 1600,
  height: 1200,
  animated: false,
  ...over,
})

describe('planImageCompression', () => {
  it('re-encodes a large file at its own size when the dimensions are already reasonable', () => {
    expect(planImageCompression(image())).toEqual({ compress: true, width: 1600, height: 1200 })
  })

  it('leaves a small, small-dimension file alone', () => {
    expect(planImageCompression(image({ size: MIN_BYTES_TO_COMPRESS - 1 })).compress).toBe(false)
  })

  it('scales a huge picture down to the longest-side limit, keeping the ratio', () => {
    const plan = planImageCompression(image({ width: 5120, height: 2560, size: 200_000 }))
    expect(plan).toEqual({ compress: true, width: MAX_STORED_SIDE, height: MAX_STORED_SIDE / 2 })
  })

  it('never enlarges a picture', () => {
    const plan = planImageCompression(image({ width: 800, height: 600 }))
    expect(plan.width).toBeLessThanOrEqual(800)
    expect(plan.height).toBeLessThanOrEqual(600)
  })

  it('keeps animated pictures and formats that must not be re-encoded', () => {
    expect(planImageCompression(image({ animated: true })).compress).toBe(false)
    expect(planImageCompression(image({ type: 'image/gif' })).compress).toBe(false)
    expect(planImageCompression(image({ type: 'image/avif' })).compress).toBe(false)
  })

  it('never rounds a thin picture down to zero pixels', () => {
    const plan = planImageCompression(image({ width: 20_000, height: 2, size: 1000 }))
    expect(plan.height).toBeGreaterThanOrEqual(1)
  })
})

describe('shouldUseCompressed', () => {
  it('accepts a WebP that is clearly smaller', () => {
    expect(shouldUseCompressed({ size: 1000 }, { type: 'image/webp', size: 800 })).toBe(true)
  })

  it('rejects a result that saves less than ten percent', () => {
    expect(shouldUseCompressed({ size: 1000 }, { type: 'image/webp', size: 950 })).toBe(false)
  })

  it('rejects a result the browser could not encode as WebP (it falls back to PNG)', () => {
    expect(shouldUseCompressed({ size: 1000 }, { type: 'image/png', size: 100 })).toBe(false)
  })

  it('rejects an empty result', () => {
    expect(shouldUseCompressed({ size: 1000 }, { type: 'image/webp', size: 0 })).toBe(false)
  })
})

describe('isAnimatedImage', () => {
  const bytes = (text: string, length = 64) => {
    const out = new Uint8Array(length)
    for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i)
    return out
  }

  it('detects an animated PNG by its acTL chunk before the image data', () => {
    expect(isAnimatedImage(bytes('\x89PNG....IHDR........acTL....IDAT'), 'image/png')).toBe(true)
    expect(isAnimatedImage(bytes('\x89PNG....IHDR........IDAT....acTL'), 'image/png')).toBe(false)
    expect(isAnimatedImage(bytes('\x89PNG....IHDR........IDAT'), 'image/png')).toBe(false)
  })

  it('detects an animated WebP by the animation flag in its VP8X header', () => {
    const animated = bytes('RIFF....WEBPVP8X')
    animated[20] = 0x02
    const still = bytes('RIFF....WEBPVP8X')
    still[20] = 0x10
    expect(isAnimatedImage(animated, 'image/webp')).toBe(true)
    expect(isAnimatedImage(still, 'image/webp')).toBe(false)
    expect(isAnimatedImage(bytes('RIFF....WEBPVP8 '), 'image/webp')).toBe(false)
  })

  it('treats other types as still', () => {
    expect(isAnimatedImage(bytes('GIF89a'), 'image/gif')).toBe(false)
  })
})
