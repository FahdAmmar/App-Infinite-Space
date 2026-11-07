import { describe, expect, it, vi } from 'vitest'
import type { ToastOptions } from '@/stores/ui-store'
import { offerUpdate } from './register'

describe('offerUpdate', () => {
  it('shows a sticky message whose Reload button activates the waiting worker, then reloads once the controller changes', () => {
    const push = vi.fn<(kind: 'success' | 'error' | 'info', message: string, options?: ToastOptions) => void>()
    const postMessage = vi.fn()
    const listeners: Array<() => void> = []
    const container = { addEventListener: vi.fn((_type: string, listener: () => void) => void listeners.push(listener)) }
    const reload = vi.fn()

    offerUpdate({ postMessage }, push, container, reload)

    const [kind, , options] = push.mock.calls[0] ?? []
    expect(kind).toBe('info')
    expect(options?.sticky).toBe(true)
    expect(options?.id).toBe('sw-update')
    // قبل الضغط لا شيء يتغير: الإصدار الجديد ينتظر
    expect(postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()

    options?.action?.run()
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(container.addEventListener).toHaveBeenCalledWith('controllerchange', reload, { once: true })
    listeners[0]?.()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
