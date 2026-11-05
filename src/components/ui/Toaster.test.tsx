import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderNode, type Rendered } from '@/test-utils/render'
import { useUiStore } from '@/stores/ui-store'
import { Toaster } from './Toaster'
import { TOAST_DURATION_MS } from './toast-durations'

let rendered: Rendered | null = null
beforeEach(() => {
  vi.useFakeTimers()
  useUiStore.setState({ toasts: [] })
})
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  vi.useRealTimers()
})

const messages = (root: HTMLElement) => [...root.querySelectorAll('p')].map((p) => p.textContent)

describe('Toaster', () => {
  it('shows a pushed message in a live region', async () => {
    rendered = await renderNode(<Toaster />)
    await act(async () => useUiStore.getState().pushToast('success', 'Saved it'))
    expect(rendered.container.querySelector('[aria-live="polite"]')).not.toBeNull()
    expect(messages(rendered.container)).toEqual(['Saved it'])
  })

  it('removes an error by itself after its longer delay, so it cannot cover the toolbar forever', async () => {
    rendered = await renderNode(<Toaster />)
    await act(async () => useUiStore.getState().pushToast('error', 'An item cannot be connected to itself.'))
    await act(async () => vi.advanceTimersByTime(TOAST_DURATION_MS.error - 1))
    expect(messages(rendered.container)).toHaveLength(1)
    await act(async () => vi.advanceTimersByTime(2))
    expect(messages(rendered.container)).toHaveLength(0)
  })

  it('removes success and info messages sooner than errors', async () => {
    expect(TOAST_DURATION_MS.success).toBeLessThan(TOAST_DURATION_MS.error)
    rendered = await renderNode(<Toaster />)
    await act(async () => useUiStore.getState().pushToast('info', 'FYI'))
    await act(async () => vi.advanceTimersByTime(TOAST_DURATION_MS.info + 1))
    expect(messages(rendered.container)).toHaveLength(0)
  })
})
