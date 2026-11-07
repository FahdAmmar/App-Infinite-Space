import { describe, expect, it, vi } from 'vitest'
import { OFFLINE_TOAST_ID, watchConnectivity } from './connectivity'

function fakeWindow() {
  const handlers = new Map<string, () => void>()
  return {
    target: {
      addEventListener: vi.fn((type: string, handler: () => void) => void handlers.set(type, handler)),
      removeEventListener: vi.fn((type: string) => void handlers.delete(type)),
    },
    fire: (type: string) => handlers.get(type)?.(),
    handlers,
  }
}

describe('watchConnectivity', () => {
  it('stays quiet while the connection is fine', () => {
    const win = fakeWindow()
    const push = vi.fn()
    watchConnectivity(push, vi.fn(), win.target, () => true)
    expect(push).not.toHaveBeenCalled()
  })

  it('shows a sticky offline message at start when already offline', () => {
    const push = vi.fn()
    watchConnectivity(push, vi.fn(), fakeWindow().target, () => false)
    expect(push).toHaveBeenCalledWith('info', expect.stringContaining('offline'), { id: OFFLINE_TOAST_ID, sticky: true })
  })

  it('shows the message when the connection drops and replaces it with a short confirmation on return', () => {
    const win = fakeWindow()
    const push = vi.fn()
    const dismiss = vi.fn()
    watchConnectivity(push, dismiss, win.target, () => true)

    win.fire('offline')
    expect(push).toHaveBeenCalledWith('info', expect.any(String), { id: OFFLINE_TOAST_ID, sticky: true })

    win.fire('online')
    expect(dismiss).toHaveBeenCalledWith(OFFLINE_TOAST_ID)
    expect(push).toHaveBeenLastCalledWith('success', 'Back online.')
  })

  it('does not announce "back online" when it was never offline', () => {
    const win = fakeWindow()
    const push = vi.fn()
    watchConnectivity(push, vi.fn(), win.target, () => true)
    win.fire('online')
    expect(push).not.toHaveBeenCalled()
  })

  it('stops listening when cleaned up', () => {
    const win = fakeWindow()
    const stop = watchConnectivity(vi.fn(), vi.fn(), win.target, () => true)
    stop()
    expect(win.handlers.size).toBe(0)
  })
})
