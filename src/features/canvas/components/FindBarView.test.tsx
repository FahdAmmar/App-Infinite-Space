import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import { FindBarView } from './FindBarView'

let rendered: Rendered | null = null
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const setup = async (overrides: Partial<Parameters<typeof FindBarView>[0]> = {}) => {
  const handlers = { onQueryChange: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn(), onClose: vi.fn() }
  rendered = await renderNode(<FindBarView query="export" position={2} total={5} inputRef={createRef<HTMLInputElement>()} {...handlers} {...overrides} />)
  const input = rendered.container.querySelector('input') as HTMLInputElement
  return { ...handlers, input, container: rendered.container }
}

const press = async (input: HTMLInputElement, key: string, shiftKey = false) => {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
  })
}
const buttonByLabel = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith(text)) ?? null

describe('FindBarView', () => {
  it('announces the position in the results', async () => {
    const { container } = await setup()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('2 of 5')
    expect(container.querySelector('[role="search"]')).not.toBeNull()
  })

  it('says "No matches" for a query with no results and stays quiet for an empty query', async () => {
    const none = await setup({ query: 'zzz', position: 0, total: 0 })
    expect(none.container.querySelector('[role="status"]')?.textContent).toBe('No matches')
    await rendered?.unmount()
    const empty = await setup({ query: '', position: 0, total: 0 })
    expect(empty.container.querySelector('[role="status"]')?.textContent).toBe('')
  })

  it('Enter goes to the next match, Shift+Enter to the previous, Escape closes', async () => {
    const { input, onNext, onPrevious, onClose } = await setup()
    await press(input, 'Enter')
    expect(onNext).toHaveBeenCalledOnce()
    await press(input, 'Enter', true)
    expect(onPrevious).toHaveBeenCalledOnce()
    await press(input, 'Escape')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('the buttons do the same, and navigation is disabled without results', async () => {
    const withResults = await setup()
    await click(buttonByLabel(withResults.container, 'Next match'))
    await click(buttonByLabel(withResults.container, 'Previous match'))
    await click(buttonByLabel(withResults.container, 'Close find'))
    expect(withResults.onNext).toHaveBeenCalledOnce()
    expect(withResults.onPrevious).toHaveBeenCalledOnce()
    expect(withResults.onClose).toHaveBeenCalledOnce()
    await rendered?.unmount()

    const without = await setup({ total: 0, position: 0 })
    expect((buttonByLabel(without.container, 'Next match') as HTMLButtonElement).disabled).toBe(true)
    expect((buttonByLabel(without.container, 'Previous match') as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports typing to the owner', async () => {
    const { input, onQueryChange } = await setup({ query: '' })
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(input, 'plan')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onQueryChange).toHaveBeenCalledWith('plan')
  })
})
