import { describe, expect, it } from 'vitest'
import { formatBytes } from './bytes'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10 * 1024 * 1024, '10 MB'],
    [5 * 1024 ** 3, '5 GB'],
  ])('formats %d as %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected)
  })

  it('treats negative, NaN and infinite input as zero', () => {
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B')
  })
})
