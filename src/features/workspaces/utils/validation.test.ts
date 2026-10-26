import { describe, expect, it } from 'vitest'
import { NAME_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from './constants'
import { normalizeText, validateWorkspaceText } from './validation'

describe('normalizeText', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeText('  My   \n Projects  ')).toBe('My Projects')
  })

  it('replaces control characters instead of keeping them', () => {
    expect(normalizeText('a\u0000b\u0007c')).toBe('a b c')
  })

  it('keeps Arabic text intact', () => {
    expect(normalizeText('  تعلّم   الألمانية ')).toBe('تعلّم الألمانية')
  })
})

describe('validateWorkspaceText', () => {
  it('accepts a normal name and returns cleaned values', () => {
    const result = validateWorkspaceText('  Learning   Roadmap ', ' notes ')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ name: 'Learning Roadmap', description: 'notes' })
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateWorkspaceText('   ', '').errors.name).toBeDefined()
    expect(validateWorkspaceText('', '').ok).toBe(false)
  })

  it('accepts a name exactly at the limit and rejects one over it', () => {
    expect(validateWorkspaceText('a'.repeat(NAME_MAX_LENGTH), '').ok).toBe(true)
    expect(validateWorkspaceText('a'.repeat(NAME_MAX_LENGTH + 1), '').errors.name).toContain(
      String(NAME_MAX_LENGTH),
    )
  })

  it('rejects an over-long description but allows an empty one', () => {
    expect(validateWorkspaceText('ok', '').ok).toBe(true)
    expect(validateWorkspaceText('ok', 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1)).errors.description).toBeDefined()
  })
})
