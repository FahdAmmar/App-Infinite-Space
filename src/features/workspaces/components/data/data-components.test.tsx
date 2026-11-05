import { afterEach, describe, expect, it, vi } from 'vitest'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import type { BackupInfo } from '@/services/persistence/storage-adapter'
import type { StorageEstimateResult } from '@/services/persistence/storage-estimate'
import { sortBackups } from '../../hooks/useBackups'
import { BackupRow } from './BackupRow'
import { StorageUsageView } from './StorageUsageView'

let rendered: Rendered | null = null
afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

const supported = (overrides: Partial<Extract<StorageEstimateResult, { supported: true }>> = {}): StorageEstimateResult => ({
  supported: true,
  usage: 5 * 1024 * 1024,
  quota: 100 * 1024 * 1024,
  ratio: 0.05,
  level: 'ok',
  persisted: null,
  ...overrides,
})

const buttonByText = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) ?? null

describe('StorageUsageView', () => {
  it('announces that it is measuring while the estimate is pending', async () => {
    rendered = await renderNode(<StorageUsageView estimate={null} outcome={null} onProtect={vi.fn()} />)
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('Checking storage')
  })

  it('exposes usage as an accessible meter with readable numbers', async () => {
    rendered = await renderNode(<StorageUsageView estimate={supported()} outcome={null} onProtect={vi.fn()} />)
    const meter = rendered.container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('5')
    expect(rendered.container.textContent).toContain('5 MB')
    expect(rendered.container.textContent).toContain('100 MB')
  })

  it('says plainly when the browser cannot report usage', async () => {
    rendered = await renderNode(<StorageUsageView estimate={{ supported: false }} outcome={null} onProtect={vi.fn()} />)
    expect(rendered.container.textContent).toContain("doesn't report")
  })

  it('warns, with a next step, when storage is nearly full', async () => {
    rendered = await renderNode(
      <StorageUsageView estimate={supported({ ratio: 0.97, level: 'critical', usage: 97, quota: 100 })} outcome={null} onProtect={vi.fn()} />,
    )
    expect(rendered.container.textContent).toMatch(/almost full.*Export/)
  })

  it('offers protection only when the browser says the data is unprotected, and reports a refusal honestly', async () => {
    const onProtect = vi.fn()
    rendered = await renderNode(<StorageUsageView estimate={supported({ persisted: false })} outcome={null} onProtect={onProtect} />)
    await click(buttonByText(rendered.container, 'Protect my data'))
    expect(onProtect).toHaveBeenCalledOnce()
    await rendered.unmount()

    rendered = await renderNode(<StorageUsageView estimate={supported({ persisted: false })} outcome="denied" onProtect={onProtect} />)
    expect(rendered.container.textContent).toContain('declined')
    await rendered.unmount()

    rendered = await renderNode(<StorageUsageView estimate={supported({ persisted: true })} outcome={null} onProtect={onProtect} />)
    expect(buttonByText(rendered.container, 'Protect my data')).toBeNull()
    expect(rendered.container.textContent).toContain('Protected')
  })
})

const backup: BackupInfo = { key: 'canvas-backup:w1', kind: 'canvas', workspaceId: 'w1', createdAt: null, sizeBytes: 2048 }

describe('BackupRow', () => {
  const handlers = () => ({ onDownload: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() })

  it('shows the label and size and wires download and restore', async () => {
    const h = handlers()
    rendered = await renderNode(<BackupRow backup={backup} label="Unreadable canvas of “Plan”" busy={false} {...h} />)
    expect(rendered.container.textContent).toContain('Unreadable canvas of “Plan”')
    expect(rendered.container.textContent).toContain('2 KB')
    await click(buttonByText(rendered.container, 'Download'))
    await click(buttonByText(rendered.container, 'Restore as new workspace'))
    expect(h.onDownload).toHaveBeenCalledOnce()
    expect(h.onRestore).toHaveBeenCalledOnce()
  })

  it('needs a second click to delete, and Cancel backs out', async () => {
    const h = handlers()
    rendered = await renderNode(<BackupRow backup={backup} label="x" busy={false} {...h} />)
    await click(buttonByText(rendered.container, 'Delete'))
    expect(h.onDelete).not.toHaveBeenCalled()
    await click(buttonByText(rendered.container, 'Cancel'))
    expect(buttonByText(rendered.container, 'Delete permanently')).toBeNull()

    await click(buttonByText(rendered.container, 'Delete'))
    await click(buttonByText(rendered.container, 'Delete permanently'))
    expect(h.onDelete).toHaveBeenCalledOnce()
  })

  it('disables every action while another one is running', async () => {
    rendered = await renderNode(<BackupRow backup={backup} label="x" busy {...handlers()} />)
    const buttons = [...rendered.container.querySelectorAll('button')]
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((b) => b.disabled)).toBe(true)
  })

  it('labels a workspace-list backup differently', async () => {
    const list: BackupInfo = { key: 'k', kind: 'workspaces', workspaceId: null, createdAt: Date.UTC(2026, 9, 27), sizeBytes: 10 }
    rendered = await renderNode(<BackupRow backup={list} label="Workspace list" busy={false} {...handlers()} />)
    expect(buttonByText(rendered.container, 'Restore workspaces')).not.toBeNull()
  })
})

describe('sortBackups', () => {
  it('puts dated backups newest first and undated ones last', () => {
    const items: BackupInfo[] = [
      { key: 'b', kind: 'canvas', workspaceId: 'b', createdAt: null, sizeBytes: 1 },
      { key: 'old', kind: 'workspaces', workspaceId: null, createdAt: 100, sizeBytes: 1 },
      { key: 'a', kind: 'canvas', workspaceId: 'a', createdAt: null, sizeBytes: 1 },
      { key: 'new', kind: 'workspaces', workspaceId: null, createdAt: 200, sizeBytes: 1 },
    ]
    expect(sortBackups(items).map((i) => i.key)).toEqual(['new', 'old', 'a', 'b'])
  })
})
