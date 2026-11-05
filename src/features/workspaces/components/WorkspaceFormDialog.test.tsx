import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import type { WorkspaceMeta } from '../types/workspace'
import { WorkspaceFormDialog } from './WorkspaceFormDialog'

let rendered: Rendered | null = null

beforeEach(() => {
  // jsdom لا ينفذ <dialog>.showModal؛ نحاكيه بخاصية open كي يُرسم المحتوى
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

const setValue = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const open = async (mode: 'create' | 'edit' = 'create', workspace?: WorkspaceMeta) => {
  const onSubmit = vi.fn()
  rendered = await renderNode(<WorkspaceFormDialog open mode={mode} workspace={workspace} onClose={() => undefined} onSubmit={onSubmit} />)
  const root = rendered.container
  return {
    root,
    onSubmit,
    name: root.querySelector('#workspace-name') as HTMLInputElement,
    template: (label: string) => [...root.querySelectorAll('input[name="workspace-template"]')].find((input) => input.parentElement?.textContent?.startsWith(label)) as HTMLInputElement,
    submit: () => act(async () => root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))),
  }
}

describe('WorkspaceFormDialog templates', () => {
  it('offers every template when creating, starting on Blank', async () => {
    const { root, template } = await open()
    const labels = [...root.querySelectorAll('input[name="workspace-template"]')].map((input) => input.parentElement?.querySelector('span span')?.textContent)
    expect(labels).toEqual(['Blank', 'Mind map', 'Kanban', 'SWOT', 'Retrospective', 'Roadmap'])
    expect(template('Blank').checked).toBe(true)
  })

  it('does not show the picker when editing a workspace', async () => {
    const workspace = { id: 'w', name: 'Old', description: '', color: 'lapis', icon: 'sparkles', createdAt: 1, updatedAt: 1, lastOpenedAt: 1, nodeCount: 0, preview: [] } as unknown as WorkspaceMeta
    const { root } = await open('edit', workspace)
    expect(root.querySelector('input[name="workspace-template"]')).toBeNull()
  })

  it('fills the empty name with the template suggestion and submits the chosen template', async () => {
    const { name, template, submit, onSubmit } = await open()
    await click(template('Kanban'))
    expect(name.value).toBe('Project board')
    await submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: 'Project board', color: 'lapis', icon: 'folder-kanban' })
    expect(onSubmit.mock.calls[0]?.[1]).toBe('kanban')
  })

  it('replaces its own earlier suggestion but never a name the user typed', async () => {
    const first = await open()
    await click(first.template('Kanban'))
    await click(first.template('SWOT'))
    expect(first.name.value).toBe('SWOT analysis')
    await setValue(first.name, 'My plan')
    await click(first.template('Roadmap'))
    expect(first.name.value).toBe('My plan')
  })

  it('submits Blank by default, so a plain workspace still starts empty', async () => {
    const { name, submit, onSubmit } = await open()
    await setValue(name, 'Notes')
    await submit()
    expect(onSubmit.mock.calls[0]?.[1]).toBe('blank')
  })

  it('keeps the color and icon the user picked when the template changes', async () => {
    const { root, name, template, submit, onSubmit } = await open()
    const rose = [...root.querySelectorAll('input[name="workspace-color"]')].find((input) => (input as HTMLInputElement).value === 'rose') as HTMLInputElement
    await click(rose)
    await click(template('Kanban'))
    expect(name.value).toBe('Project board')
    await submit()
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ color: 'rose' })
  })
})
