import { afterEach, describe, expect, it, vi } from 'vitest'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import { PersistenceContext, type PersistenceActions } from '../persistence/persistence-context'
import { ExternalChangeBanner } from './ExternalChangeBanner'

let rendered: Rendered | null = null
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const actions = (overrides: Partial<PersistenceActions> = {}): PersistenceActions => ({
  retry: vi.fn(),
  externalChange: true,
  keepMine: vi.fn(),
  reloadLatest: vi.fn(),
  flush: vi.fn(async () => undefined),
  ...overrides,
})

const buttonByText = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === text) ?? null

describe('ExternalChangeBanner', () => {
  it('renders nothing while no other tab has changed the workspace', async () => {
    rendered = await renderNode(
      <PersistenceContext value={actions({ externalChange: false })}>
        <ExternalChangeBanner />
      </PersistenceContext>,
    )
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull()
  })

  it('explains the situation and lets the user choose either version', async () => {
    const value = actions()
    rendered = await renderNode(
      <PersistenceContext value={value}>
        <ExternalChangeBanner />
      </PersistenceContext>,
    )
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('changed in another tab')
    await click(buttonByText(rendered.container, 'Load latest'))
    expect(value.reloadLatest).toHaveBeenCalledOnce()
    expect(value.keepMine).not.toHaveBeenCalled()
    await click(buttonByText(rendered.container, 'Keep this version'))
    expect(value.keepMine).toHaveBeenCalledOnce()
  })
})
