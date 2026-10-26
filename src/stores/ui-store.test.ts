import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './ui-store'

const KEY = 'infinitespace:v1:ui'

beforeEach(() => {
  localStorage.clear()
  useUiStore.setState({ theme: 'dark', workspaceSort: 'modified', backgroundEffect: true, toasts: [] })
})

async function rehydrateWith(state: unknown): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify({ state, version: 0 }))
  await useUiStore.persist.rehydrate()
}

describe('background effect preference', () => {
  it('is on by default and can be switched off and on', () => {
    expect(useUiStore.getState().backgroundEffect).toBe(true)
    useUiStore.getState().setBackgroundEffect(false)
    expect(useUiStore.getState().backgroundEffect).toBe(false)
    useUiStore.getState().setBackgroundEffect(true)
    expect(useUiStore.getState().backgroundEffect).toBe(true)
  })

  it('is saved with the other preferences', () => {
    useUiStore.getState().setBackgroundEffect(false)
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { state?: Record<string, unknown> }
    expect(saved.state?.backgroundEffect).toBe(false)
  })

  it('is restored from storage when valid', async () => {
    await rehydrateWith({ theme: 'light', workspaceSort: 'name', backgroundEffect: false })
    expect(useUiStore.getState()).toMatchObject({ theme: 'light', workspaceSort: 'name', backgroundEffect: false })
  })

  it('ignores stored values of the wrong type (storage is untrusted)', async () => {
    await rehydrateWith({ theme: 'neon', workspaceSort: 'random', backgroundEffect: 'yes' })
    expect(useUiStore.getState()).toMatchObject({ theme: 'dark', workspaceSort: 'modified', backgroundEffect: true })
  })

  it('keeps the default when the preference is missing (older saved data)', async () => {
    await rehydrateWith({ theme: 'light' })
    expect(useUiStore.getState()).toMatchObject({ theme: 'light', backgroundEffect: true })
  })
})

describe('toasts', () => {
  it('does not stack the same message twice', () => {
    useUiStore.getState().pushToast('error', 'Same')
    useUiStore.getState().pushToast('error', 'Same')
    expect(useUiStore.getState().toasts).toHaveLength(1)
  })

  it('keeps only the latest four', () => {
    for (let i = 0; i < 7; i += 1) useUiStore.getState().pushToast('info', `m${i}`)
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['m3', 'm4', 'm5', 'm6'])
  })

  it('dismisses by id and never persists toasts', () => {
    useUiStore.getState().pushToast('success', 'Saved')
    const [toast] = useUiStore.getState().toasts
    useUiStore.getState().dismissToast(toast?.id ?? '')
    expect(useUiStore.getState().toasts).toHaveLength(0)
    useUiStore.getState().pushToast('success', 'Another')
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { state?: Record<string, unknown> }
    expect(saved.state).not.toHaveProperty('toasts')
  })
})
