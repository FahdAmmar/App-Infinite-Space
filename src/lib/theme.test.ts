// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isThemeMode, resolveTheme, systemPrefersDark } from './theme'

afterEach(() => vi.unstubAllGlobals())

describe('resolveTheme', () => {
  it('keeps a fixed theme regardless of the system', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
  it('follows the system in "system" mode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('isThemeMode', () => {
  it('accepts only the three known modes', () => {
    expect(['dark', 'light', 'system'].every(isThemeMode)).toBe(true)
    expect(isThemeMode('neon')).toBe(false)
    expect(isThemeMode(undefined)).toBe(false)
    expect(isThemeMode(1)).toBe(false)
  })
})

describe('systemPrefersDark', () => {
  it('reads the media query', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark') }))
    expect(systemPrefersDark()).toBe(true)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(systemPrefersDark()).toBe(false)
  })
  it('falls back to dark when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemPrefersDark()).toBe(true)
  })
})
