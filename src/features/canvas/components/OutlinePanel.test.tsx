import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCanvasStore } from '@/stores/canvas-store'
import { CanvasStoreContext } from '@/stores/canvas-store-context'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import type { CanvasNode } from '../types/nodes'
import { createGroup, createStickyNote } from '../utils/node-factory'
import { OutlinePanel } from './OutlinePanel'

let rendered: Rendered | null = null
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const sticky = (id: string, y: number, title: string, parentId?: string): CanvasNode => {
  const node = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...node, id, position: { x: 0, y }, ...(parentId ? { parentId } : {}), data: { ...node.data, title } }
}
const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 0, y: 0 }, data: { ...createGroup({ x: 0, y: 0 }, 1).data, label: 'Research' } }

const setup = async (nodes: CanvasNode[], open = true) => {
  const store = createCanvasStore({ initialNodes: nodes })
  if (open) store.getState().setOutlineOpen(true)
  const focusNode = vi.fn()
  const commands = { focusNode } as unknown as CanvasCommands
  rendered = await renderNode(
    <CanvasStoreContext value={store}>
      <OutlinePanel commands={commands} />
    </CanvasStoreContext>,
  )
  const root = rendered.container
  const rows = () => Array.from(root.querySelectorAll<HTMLButtonElement>('li button'))
  return { store, focusNode, root, rows }
}

describe('OutlinePanel', () => {
  it('renders nothing while closed', async () => {
    const { root } = await setup([sticky('a', 0, 'Alpha')], false)
    expect(root.querySelector('aside')).toBeNull()
  })

  it('lists the groups with their cards, then free cards, with the group size', async () => {
    const { rows } = await setup([group, sticky('m', 10, 'Interview', 'g'), sticky('f', 500, 'Loose idea')])
    expect(rows().map((row) => row.textContent)).toEqual(['Research1', 'Interview', 'Loose idea'])
  })

  it('jumps to a card when its row is clicked', async () => {
    const { rows, focusNode } = await setup([sticky('a', 0, 'Alpha'), sticky('b', 100, 'Beta')])
    await click(rows()[1] ?? null)
    expect(focusNode).toHaveBeenCalledWith('b')
  })

  it('filters rows with the search box (Arabic included) and says when nothing matches', async () => {
    const { root, rows } = await setup([sticky('a', 0, 'Alpha'), sticky('b', 100, 'أفكار المشروع')])
    const input = root.querySelector('input') as HTMLInputElement
    const type = async (value: string) =>
      act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    await type('أفكار')
    expect(rows().map((row) => row.textContent)).toEqual(['أفكار المشروع'])
    await type('zzz')
    expect(rows()).toHaveLength(0)
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Nothing matches.')
  })

  it('marks the selected card for assistive technology', async () => {
    const { rows, store } = await setup([sticky('a', 0, 'Alpha'), sticky('b', 100, 'Beta')])
    await act(async () => store.getState().selectNodes(['b']))
    expect(rows().map((row) => row.getAttribute('aria-current'))).toEqual([null, 'true'])
  })

  it('closes on Escape and with the close button', async () => {
    const { root, store } = await setup([sticky('a', 0, 'Alpha')])
    const aside = root.querySelector('aside') as HTMLElement
    await act(async () => {
      aside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(store.getState().outlineOpen).toBe(false)
  })

  it('says so when the canvas is empty', async () => {
    const { root } = await setup([])
    expect(root.querySelector('[role="status"]')?.textContent).toBe('The canvas is empty.')
  })
})
