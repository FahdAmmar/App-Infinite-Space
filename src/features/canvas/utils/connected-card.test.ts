import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types/nodes'
import { NODE_SIZES } from './constants'
import { isIntentionalDrag, MIN_CONNECTED_DRAG_PX, newCardCenter, oppositeSide, planConnectedCard } from './connected-card'
import { createStickyNote } from './node-factory'

const origin: CanvasNode = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'origin' }
const { width, height } = NODE_SIZES.sticky

describe('newCardCenter', () => {
  it('puts the card edge that faces the handle exactly on the drop point', () => {
    const drop = { x: 500, y: 300 }
    expect(newCardCenter(drop, 'right')).toEqual({ x: 500 + width / 2, y: 300 })
    expect(newCardCenter(drop, 'left')).toEqual({ x: 500 - width / 2, y: 300 })
    expect(newCardCenter(drop, 'bottom')).toEqual({ x: 500, y: 300 + height / 2 })
    expect(newCardCenter(drop, 'top')).toEqual({ x: 500, y: 300 - height / 2 })
  })
})

describe('planConnectedCard', () => {
  it('creates a note and a connection from the origin to it, leaving by the dragged side', () => {
    const { node, edge } = planConnectedCard(origin, 'right', { x: 600, y: 120 }, 5)
    expect(node.type).toBe('sticky')
    expect(edge.source).toBe('origin')
    expect(edge.target).toBe(node.id)
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
  })

  it('enters the new card on the side facing the origin', () => {
    expect(planConnectedCard(origin, 'top', { x: 0, y: -300 }, 5).edge.targetHandle).toBe('bottom')
    expect(planConnectedCard(origin, 'bottom', { x: 0, y: 500 }, 5).edge.targetHandle).toBe('top')
    expect(planConnectedCard(origin, 'left', { x: -400, y: 0 }, 5).edge.targetHandle).toBe('right')
  })

  it('places the new card so its center is on the drop side of the origin', () => {
    const { node } = planConnectedCard(origin, 'right', { x: 600, y: 120 }, 5)
    expect(node.position.x + width / 2).toBeGreaterThan(600)
  })
})

describe('isIntentionalDrag', () => {
  it('ignores a click on the handle and accepts a real drag', () => {
    expect(isIntentionalDrag({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(false)
    expect(isIntentionalDrag({ x: 10, y: 10 }, { x: 10 + MIN_CONNECTED_DRAG_PX, y: 10 })).toBe(true)
  })
})

describe('oppositeSide', () => {
  it('maps every side to its opposite and back', () => {
    for (const side of ['left', 'right', 'top', 'bottom'] as const) expect(oppositeSide(oppositeSide(side))).toBe(side)
  })
})
