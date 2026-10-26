import { describe, expect, it } from 'vitest'
import { NAME_MAX_LENGTH } from './constants'
import { createWorkspaceMeta, duplicateWorkspaceMeta, makeCopyName } from './factory'

describe('makeCopyName', () => {
  it('appends "(copy)" first', () => {
    expect(makeCopyName('My Projects', ['My Projects'])).toBe('My Projects (copy)')
  })

  it('numbers further copies', () => {
    expect(makeCopyName('A', ['A', 'A (copy)'])).toBe('A (copy 2)')
    expect(makeCopyName('A', ['A', 'A (copy)', 'A (copy 2)'])).toBe('A (copy 3)')
  })

  it('does not stack suffixes when duplicating a copy', () => {
    expect(makeCopyName('A (copy)', ['A', 'A (copy)'])).toBe('A (copy 2)')
  })

  it('is case-insensitive when checking for collisions', () => {
    expect(makeCopyName('A', ['a (COPY)'])).toBe('A (copy 2)')
  })

  it('never exceeds the maximum name length', () => {
    const long = 'x'.repeat(NAME_MAX_LENGTH)
    const copy = makeCopyName(long, [long])
    expect(copy.length).toBeLessThanOrEqual(NAME_MAX_LENGTH)
    expect(copy.endsWith(' (copy)')).toBe(true)
  })
})

describe('createWorkspaceMeta / duplicateWorkspaceMeta', () => {
  const input = { name: 'Space', description: 'd', color: 'moss', icon: 'rocket' } as const

  it('creates a fresh, never-opened workspace', () => {
    const meta = createWorkspaceMeta(input, 1000)
    expect(meta).toMatchObject({ name: 'Space', createdAt: 1000, updatedAt: 1000, lastOpenedAt: null, nodeCount: 0 })
    expect(meta.id).toBeTruthy()
  })

  it('duplicates with a new id and fresh timestamps but keeps content settings', () => {
    const source = {
      ...createWorkspaceMeta(input, 1),
      lastOpenedAt: 50,
      nodeCount: 3,
      preview: [{ x: 0, y: 0, w: 0.5, h: 0.5, kind: 'sticky' as const }],
    }
    const copy = duplicateWorkspaceMeta(source, 'Space (copy)', 2000)

    expect(copy.id).not.toBe(source.id)
    expect(copy).toMatchObject({ name: 'Space (copy)', createdAt: 2000, updatedAt: 2000, lastOpenedAt: null })
    expect(copy.nodeCount).toBe(3)
    expect(copy.preview).toEqual(source.preview)
    expect(copy.preview).not.toBe(source.preview) // نسخة مستقلة وليست نفس المرجع
  })
})
