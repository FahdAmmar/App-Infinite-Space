import { describe, expect, it } from 'vitest'
import { approach, fibonacciSphere, smoothing } from './fibonacci-sphere'

describe('fibonacciSphere', () => {
  it('returns three coordinates per point', () => {
    expect(fibonacciSphere(10, 1)).toHaveLength(30)
    expect(fibonacciSphere(0, 1)).toHaveLength(0)
    expect(fibonacciSphere(-5, 1)).toHaveLength(0)
  })

  it('places every point on the sphere of the given radius', () => {
    const radius = 2.35
    const points = fibonacciSphere(200, radius)
    for (let i = 0; i < points.length; i += 3) {
      const length = Math.hypot(points[i] ?? 0, points[i + 1] ?? 0, points[i + 2] ?? 0)
      expect(length).toBeCloseTo(radius, 4)
    }
  })

  it('covers both poles and spreads points evenly in height', () => {
    const points = fibonacciSphere(101, 1)
    expect(points[1]).toBeCloseTo(1, 5) // أول نقطة عند القطب العلوي
    expect(points[100 * 3 + 1]).toBeCloseTo(-1, 5) // الأخيرة عند السفلي
    // الارتفاع ينقص بخطوات متساوية
    const step = (points[1] ?? 0) - (points[4] ?? 0)
    expect(step).toBeCloseTo(2 / 100, 5)
  })

  it('handles a single point without dividing by zero', () => {
    const [x, y, z] = fibonacciSphere(1, 3)
    expect([x, y, z].every((v) => Number.isFinite(v))).toBe(true)
    expect(Math.hypot(x ?? 0, y ?? 0, z ?? 0)).toBeCloseTo(3, 5)
  })

  it('produces distinct points (no clumping at the same location)', () => {
    const points = fibonacciSphere(300, 1)
    const seen = new Set<string>()
    for (let i = 0; i < points.length; i += 3) {
      seen.add(`${points[i]?.toFixed(3)},${points[i + 1]?.toFixed(3)},${points[i + 2]?.toFixed(3)}`)
    }
    expect(seen.size).toBe(300)
  })
})

describe('approach / smoothing', () => {
  it('moves part of the way toward the target and clamps t', () => {
    expect(approach(0, 10, 0.5)).toBe(5)
    expect(approach(0, 10, 2)).toBe(10)
    expect(approach(0, 10, -1)).toBe(0)
  })

  it('smoothing is frame-rate independent: two half steps equal one full step', () => {
    const one = 1 - smoothing(3, 0.2)
    const two = (1 - smoothing(3, 0.1)) ** 2
    expect(two).toBeCloseTo(one, 10)
  })

  it('smoothing is 0 for no time and never exceeds 1', () => {
    expect(smoothing(3, 0)).toBe(0)
    expect(smoothing(3, -1)).toBe(0)
    expect(smoothing(3, 1000)).toBeLessThanOrEqual(1)
  })
})
