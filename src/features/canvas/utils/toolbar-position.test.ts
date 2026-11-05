import { describe, expect, it } from 'vitest'
import { clampShiftIntoView, computeToolbarShift } from './toolbar-position'

describe('clampShiftIntoView', () => {
  it('leaves a toolbar that already fits where it is', () => {
    expect(clampShiftIntoView(40, 300, 390, 8)).toBe(0)
  })

  it('pulls a toolbar that overflows the right edge back inside', () => {
    expect(clampShiftIntoView(120, 460, 390, 8)).toBe(-78) // يصبح right = 382
  })

  it('pushes a toolbar that overflows the left edge inside', () => {
    expect(clampShiftIntoView(-50, 200, 390, 8)).toBe(58) // يصبح left = 8
  })

  it('aligns an over-wide toolbar to the left edge instead of cutting both sides', () => {
    expect(clampShiftIntoView(-30, 420, 390, 8)).toBe(38)
  })

  it('keeps the requested gap from an edge it already touches', () => {
    expect(clampShiftIntoView(0, 200, 390, 8)).toBe(8)
    expect(clampShiftIntoView(100, 390, 390, 8)).toBe(-8)
  })
})

describe('computeToolbarShift', () => {
  const viewport = { width: 390, height: 844 }
  const safe = { gap: 8, top: 72, offset: 16 }
  const selection = { left: 20, top: 150, right: 250, bottom: 360 }

  it('does nothing when the toolbar fits above the selection', () => {
    expect(computeToolbarShift({ left: 40, top: 100, right: 300, bottom: 140 }, selection, viewport, safe)).toEqual({ x: 0, y: 0 })
  })

  it('flips below the selection when the top bar would cover the toolbar', () => {
    const bar = { left: 40, top: 20, right: 300, bottom: 120 }
    expect(computeToolbarShift(bar, selection, viewport, safe)).toEqual({ x: 0, y: 360 + 16 - 20 })
  })

  it('moves just under the top bar when there is no room below either', () => {
    const tall = { left: 20, top: 100, right: 250, bottom: 800 }
    const bar = { left: 40, top: 20, right: 300, bottom: 120 }
    expect(computeToolbarShift(bar, tall, viewport, safe)).toEqual({ x: 0, y: 72 - 20 })
  })

  it('does not flip below the selection into a panel that starts there', () => {
    const bar = { left: 40, top: 20, right: 300, bottom: 120 }
    // تحت التحديد 376 + ارتفاع 100 = 476 > 400 (أعلى لوحة تحتها)، فينزل إلى المنطقة الآمنة بدل أن تغطيه اللوحة
    expect(computeToolbarShift(bar, selection, viewport, { ...safe, bottom: 400 })).toEqual({ x: 0, y: 52 })
    expect(computeToolbarShift(bar, selection, viewport, { ...safe, bottom: 600 })).toEqual({ x: 0, y: 356 })
  })

  it('falls back to the safe top when the selection is unknown', () => {
    expect(computeToolbarShift({ left: 40, top: 10, right: 300, bottom: 50 }, null, viewport, safe)).toEqual({ x: 0, y: 62 })
  })

  it('also pulls a toolbar back from the right edge in the same call', () => {
    expect(computeToolbarShift({ left: 150, top: 100, right: 420, bottom: 140 }, selection, viewport, safe)).toEqual({ x: -38, y: 0 })
  })
})
