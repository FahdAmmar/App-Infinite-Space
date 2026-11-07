import { describe, expect, it } from 'vitest'
import { getStatus, isLocked, nextStatus, syncLockFlags, withLocked, withStatus } from './card-flags'
import { createGroup, createStickyNote } from './node-factory'

const sticky = () => createStickyNote({ x: 0, y: 0 }, 1)

describe('nextStatus', () => {
  it('cycles none, doing, done, none', () => {
    expect(nextStatus('none')).toBe('doing')
    expect(nextStatus('doing')).toBe('done')
    expect(nextStatus('done')).toBe('none')
  })
})

describe('withStatus', () => {
  it('sets a status and stamps updatedAt', () => {
    const next = withStatus(sticky(), 'done', 99)
    expect(getStatus(next)).toBe('done')
    expect(next.data.updatedAt).toBe(99)
  })

  it('removes the key when returning to none, and returns the same node when nothing changes', () => {
    const done = withStatus(sticky(), 'done', 5)
    const cleared = withStatus(done, 'none', 6)
    expect('status' in cleared.data).toBe(false)
    const note = sticky()
    expect(withStatus(note, 'none', 7)).toBe(note)
  })

  it('never gives a group a status', () => {
    const group = createGroup({ x: 0, y: 0 }, 1)
    expect(withStatus(group, 'done', 5)).toBe(group)
  })
})

describe('withLocked / syncLockFlags', () => {
  it('locks: data and both React Flow flags change together', () => {
    const next = withLocked(sticky(), true, 10)
    expect(isLocked(next)).toBe(true)
    expect(next.draggable).toBe(false)
    expect(next.deletable).toBe(false)
    expect(next.data.updatedAt).toBe(10)
  })

  it('unlocks: key and flags are removed, not stored as false', () => {
    const next = withLocked(withLocked(sticky(), true, 10), false, 11)
    expect(isLocked(next)).toBe(false)
    expect('locked' in next.data).toBe(false)
    expect('draggable' in next).toBe(false)
    expect('deletable' in next).toBe(false)
  })

  it('returns the same node when the state already matches', () => {
    const note = sticky()
    expect(withLocked(note, false, 5)).toBe(note)
  })

  it('syncLockFlags repairs a node whose flags disagree with its data', () => {
    const broken = { ...sticky(), draggable: false, deletable: false }
    const fixed = syncLockFlags(broken)
    expect('draggable' in fixed).toBe(false)
    expect('deletable' in fixed).toBe(false)
  })
})
