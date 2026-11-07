// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import type { MenuEntry } from '../utils/context-menu'
import { ContextMenuView } from './ContextMenuView'

let rendered: Rendered | null = null
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const entries: MenuEntry[] = [
  { id: 'duplicate', label: 'Duplicate', hint: 'Ctrl/⌘ D' },
  { id: 'paste', label: 'Paste', disabled: true },
  'separator',
  { id: 'delete', label: 'Delete', danger: true },
]

const setup = async () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  rendered = await renderNode(<ContextMenuView entries={entries} point={{ x: 100, y: 120 }} onSelect={onSelect} onClose={onClose} />)
  const root = rendered.container.querySelector('[role="menu"]') as HTMLElement
  const items = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const press = async (key: string) =>
    act(async () => {
      ;(document.activeElement ?? root).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
  return { onSelect, onClose, root, items, press }
}

describe('ContextMenuView', () => {
  it('renders menu items, a separator and shortcut hints at the click point', async () => {
    const { root, items } = await setup()
    expect(items().map((item) => item.textContent)).toEqual(['DuplicateCtrl/⌘ D', 'Paste', 'Delete'])
    expect(root.querySelectorAll('[role="separator"]')).toHaveLength(1)
    expect(root.style.left).toBe('100px')
    expect(root.style.top).toBe('120px')
  })

  it('focuses the first available item so the keyboard works at once', async () => {
    const { items } = await setup()
    expect(document.activeElement).toBe(items()[0])
  })

  it('runs the chosen action when clicked, but not a disabled one', async () => {
    const { items, onSelect } = await setup()
    await click(items()[2] ?? null)
    expect(onSelect).toHaveBeenCalledWith('delete')
    await click(items()[1] ?? null)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('moves with the arrow keys, skipping disabled items and wrapping around', async () => {
    const { items, press } = await setup()
    await press('ArrowDown')
    expect(document.activeElement).toBe(items()[2]) // Paste is disabled
    await press('ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    await press('ArrowUp')
    expect(document.activeElement).toBe(items()[2])
    await press('Home')
    expect(document.activeElement).toBe(items()[0])
    await press('End')
    expect(document.activeElement).toBe(items()[2])
  })

  it('closes on Escape and on Tab', async () => {
    const { onClose, press } = await setup()
    await press('Escape')
    await press('Tab')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on a press outside, but not on one inside', async () => {
    const { onClose, root } = await setup()
    await act(async () => {
      root.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('suppresses the browser menu on top of itself', async () => {
    const { root } = await setup()
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    await act(async () => {
      root.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
  })
})
