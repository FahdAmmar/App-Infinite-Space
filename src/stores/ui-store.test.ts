// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from './ui-store'

const KEY = 'infinitespace:v1:ui'

beforeEach(() => {
  localStorage.clear()
  useUiStore.setState({ theme: 'dark', themeMode: 'dark', highContrast: false, checklistDismissed: false, workspaceSort: 'modified', backgroundEffect: true, snapToGrid: false, compressImages: true, toasts: [] })
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

describe('snap to grid preference', () => {
  it('is off by default, can be switched, and is saved', () => {
    expect(useUiStore.getState().snapToGrid).toBe(false)
    useUiStore.getState().setSnapToGrid(true)
    expect(useUiStore.getState().snapToGrid).toBe(true)
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { state?: Record<string, unknown> }
    expect(saved.state?.snapToGrid).toBe(true)
  })

  it('is restored when valid and ignored when it is the wrong type', async () => {
    await rehydrateWith({ snapToGrid: true })
    expect(useUiStore.getState().snapToGrid).toBe(true)
    useUiStore.setState({ snapToGrid: false }) // نعود للافتراضي: القيمة الخاطئة تُهمل فيبقى الحالي
    await rehydrateWith({ snapToGrid: 'yes' })
    expect(useUiStore.getState().snapToGrid).toBe(false)
  })
})

describe('image compression preference', () => {
  it('is on by default, can be switched off, and is saved', () => {
    expect(useUiStore.getState().compressImages).toBe(true)
    useUiStore.getState().setCompressImages(false)
    expect(useUiStore.getState().compressImages).toBe(false)
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { state?: Record<string, unknown> }
    expect(saved.state?.compressImages).toBe(false)
  })

  it('is restored when valid, ignored when the wrong type, and defaults to on for older saved data', async () => {
    await rehydrateWith({ compressImages: false })
    expect(useUiStore.getState().compressImages).toBe(false)
    useUiStore.setState({ compressImages: true })
    await rehydrateWith({ compressImages: 'no' })
    expect(useUiStore.getState().compressImages).toBe(true)
    await rehydrateWith({ theme: 'dark' })
    expect(useUiStore.getState().compressImages).toBe(true)
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

describe('theme modes', () => {
  it('an explicit theme choice replaces the automatic mode', () => {
    useUiStore.getState().setThemeMode('system')
    useUiStore.getState().setTheme('light')
    expect(useUiStore.getState()).toMatchObject({ theme: 'light', themeMode: 'light' })
    useUiStore.getState().setThemeMode('system')
    useUiStore.getState().toggleTheme()
    expect(useUiStore.getState().themeMode).not.toBe('system')
  })

  it('follows the system only in automatic mode', () => {
    useUiStore.getState().setThemeMode('system')
    useUiStore.getState().syncSystemTheme(false)
    expect(useUiStore.getState().theme).toBe('light')
    useUiStore.getState().syncSystemTheme(true)
    expect(useUiStore.getState().theme).toBe('dark')
    useUiStore.getState().setTheme('dark')
    useUiStore.getState().syncSystemTheme(false)
    expect(useUiStore.getState().theme).toBe('dark')
  })

  it('restores the saved mode, and treats an older saved theme as an explicit choice', async () => {
    await rehydrateWith({ themeMode: 'system', highContrast: true, checklistDismissed: true })
    expect(useUiStore.getState()).toMatchObject({ themeMode: 'system', highContrast: true, checklistDismissed: true })
    await rehydrateWith({ theme: 'light' })
    expect(useUiStore.getState()).toMatchObject({ themeMode: 'light', theme: 'light' })
  })

  it('ignores unknown saved values', async () => {
    await rehydrateWith({ themeMode: 'neon', highContrast: 'yes', checklistDismissed: 1 })
    expect(useUiStore.getState()).toMatchObject({ themeMode: 'dark', highContrast: false, checklistDismissed: false })
  })
})

describe('toast options', () => {
  it('replaces a toast that reuses an id instead of stacking a copy', () => {
    useUiStore.setState({ toasts: [] })
    useUiStore.getState().pushToast('info', 'first', { id: 'offline', sticky: true })
    useUiStore.getState().pushToast('info', 'second', { id: 'offline', sticky: true })
    const toasts = useUiStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id: 'offline', message: 'second', sticky: true })
  })

  it('keeps an action on the toast and can dismiss it by id', () => {
    useUiStore.setState({ toasts: [] })
    const run = vi.fn()
    useUiStore.getState().pushToast('info', 'update', { id: 'sw-update', action: { label: 'Reload', run } })
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Reload')
    useUiStore.getState().dismissToast('sw-update')
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })
})
