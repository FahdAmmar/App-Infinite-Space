import { describe, expect, it } from 'vitest'
import { labelScale } from './semantic-zoom'

describe('labelScale', () => {
  it('leaves labels alone at readable zoom levels', () => {
    expect(labelScale(1)).toBe(1)
    expect(labelScale(0.75)).toBe(1)
    expect(labelScale(2)).toBe(1)
  })

  it('grows labels as the canvas shrinks', () => {
    expect(labelScale(0.5)).toBe(1.5)
    expect(labelScale(0.375)).toBe(2)
  })

  it('never exceeds the cap', () => {
    expect(labelScale(0.1)).toBe(3)
    expect(labelScale(0.01)).toBe(3)
  })

  it('moves in quarter steps so the value changes rarely while zooming', () => {
    const values = new Set<number>()
    for (let zoom = 0.7; zoom >= 0.25; zoom -= 0.001) values.add(labelScale(zoom))
    expect(values.size).toBeLessThanOrEqual(10)
    for (const value of values) expect(value * 4).toBe(Math.round(value * 4))
  })

  it('ignores invalid input', () => {
    expect(labelScale(0)).toBe(1)
    expect(labelScale(-1)).toBe(1)
    expect(labelScale(Number.NaN)).toBe(1)
  })
})
