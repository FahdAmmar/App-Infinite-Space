// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createSnippet, MAX_SNIPPETS } from '@/features/canvas/utils/snippets'
import { createStickyNote } from '@/features/canvas/utils/node-factory'
import { useSnippetStore } from './snippet-store'

const KEY = 'infinitespace:v1:snippets'
const make = (id: string) => {
  const result = createSnippet([{ ...createStickyNote({ x: 0, y: 0 }, 1), id: `n-${id}`, selected: true }], [], id, 1)
  if (!result.ok) throw new Error('expected a snippet')
  return result.snippet
}

beforeEach(() => {
  localStorage.clear()
  useSnippetStore.setState({ snippets: [] })
})

describe('snippet store', () => {
  it('adds newest first, removes by id, and saves to localStorage', () => {
    useSnippetStore.getState().addSnippet(make('a'))
    useSnippetStore.getState().addSnippet(make('b'))
    expect(useSnippetStore.getState().snippets.map((snippet) => snippet.id)).toEqual(['b', 'a'])
    useSnippetStore.getState().removeSnippet('b')
    expect(useSnippetStore.getState().snippets.map((snippet) => snippet.id)).toEqual(['a'])
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { state?: { snippets?: unknown[] } }
    expect(saved.state?.snippets).toHaveLength(1)
  })

  it('refuses a snippet beyond the limit', () => {
    for (let i = 0; i < MAX_SNIPPETS; i += 1) expect(useSnippetStore.getState().addSnippet(make(`s${i}`))).toBe(true)
    expect(useSnippetStore.getState().addSnippet(make('extra'))).toBe(false)
    expect(useSnippetStore.getState().snippets).toHaveLength(MAX_SNIPPETS)
  })

  it('restores saved snippets and survives corrupt storage', async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { snippets: [make('keep'), { id: 'bad' }, 42] }, version: 0 }))
    await useSnippetStore.persist.rehydrate()
    expect(useSnippetStore.getState().snippets.map((snippet) => snippet.id)).toEqual(['keep'])
    localStorage.setItem(KEY, JSON.stringify({ state: 'garbage', version: 0 }))
    await useSnippetStore.persist.rehydrate()
    expect(useSnippetStore.getState().snippets).toEqual([])
  })
})
