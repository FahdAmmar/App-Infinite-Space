import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import { CommandPaletteView, type PaletteItem } from './CommandPaletteView'

let rendered: Rendered | null = null

beforeEach(() => {
  // jsdom لا ينفذ <dialog>.showModal؛ نحاكيه بخاصية open كي يُرسم المحتوى ويستجيب للوحة المفاتيح
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const makeItems = () => {
  const run = { sticky: vi.fn(), fit: vi.fn(), find: vi.fn(), theme: vi.fn() }
  const items: PaletteItem[] = [
    { id: 'sticky', title: 'Add sticky note', group: 'Create', hint: 'N', run: run.sticky },
    { id: 'fit', title: 'Fit all content', group: 'View', run: run.fit },
    { id: 'find', title: 'Find on canvas', group: 'Search', run: run.find },
    { id: 'theme', title: 'Switch to light theme', group: 'View', keywords: ['appearance'], run: run.theme },
  ]
  return { items, run }
}

const setup = async () => {
  const { items } = makeItems()
  const onRun = vi.fn()
  const onClose = vi.fn()
  rendered = await renderNode(<CommandPaletteView open items={items} onClose={onClose} onRun={onRun} />)
  const input = rendered.container.querySelector('input[role="combobox"]') as HTMLInputElement
  return { items, onRun, onClose, input, root: rendered.container }
}

const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const press = async (input: HTMLInputElement, key: string) => {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}
const titles = (root: HTMLElement) => [...root.querySelectorAll('[role="option"]')].map((option) => option.querySelector('span')?.textContent)

describe('CommandPaletteView', () => {
  it('lists every command when the search is empty and shows the shortcut hint', async () => {
    const { root } = await setup()
    expect(titles(root)).toEqual(['Add sticky note', 'Fit all content', 'Find on canvas', 'Switch to light theme'])
    expect(root.querySelector('kbd')?.textContent).toBe('N')
  })

  it('narrows the list as the user types and matches hidden synonyms', async () => {
    const { input, root } = await setup()
    await type(input, 'fi')
    expect(titles(root)).toEqual(['Fit all content', 'Find on canvas'])
    await type(input, 'appearance')
    expect(titles(root)).toEqual(['Switch to light theme'])
  })

  it('moves with the arrow keys, wraps around, and runs the active command on Enter', async () => {
    const { input, onRun, items } = await setup()
    await press(input, 'ArrowDown')
    await press(input, 'Enter')
    expect(onRun).toHaveBeenCalledWith(items[1])
    await press(input, 'ArrowUp')
    await press(input, 'ArrowUp')
    await press(input, 'Enter')
    expect(onRun).toHaveBeenLastCalledWith(items[3])
  })

  it('points aria-activedescendant at the highlighted option', async () => {
    const { input, root } = await setup()
    await press(input, 'ArrowDown')
    const active = root.querySelector('[role="option"][aria-selected="true"]')
    expect(active?.id).toBeTruthy()
    expect(input.getAttribute('aria-activedescendant')).toBe(active?.id)
    expect(titles(root)[1]).toBe('Fit all content')
  })

  it('runs a command when its row is clicked', async () => {
    const { onRun, items, root } = await setup()
    await click(root.querySelectorAll('[role="option"]')[2] ?? null)
    expect(onRun).toHaveBeenCalledWith(items[2])
  })

  it('says so and runs nothing when no command matches', async () => {
    const { input, onRun, root } = await setup()
    await type(input, 'zebra')
    expect(titles(root)).toEqual([])
    expect(root.querySelector('[role="status"]')?.textContent).toBe('No matching commands')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    await press(input, 'Enter')
    expect(onRun).not.toHaveBeenCalled()
  })

  it('starts the highlight at the first result again after the query changes', async () => {
    const { input, root } = await setup()
    await press(input, 'ArrowDown')
    await press(input, 'ArrowDown')
    await type(input, 'f')
    expect(root.querySelector('[role="option"][aria-selected="true"]')?.querySelector('span')?.textContent).toBe('Fit all content')
  })
})
