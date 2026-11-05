import { describe, expect, it } from 'vitest'
import { filterCommands } from './command-search'

const commands = [
  { id: 'sticky', title: 'Add sticky note', keywords: ['card'] },
  { id: 'image', title: 'Add image…', keywords: ['picture', 'photo'] },
  { id: 'fit', title: 'Fit all content' },
  { id: 'find', title: 'Find on canvas' },
  { id: 'theme', title: 'Switch to light theme' },
  { id: 'open-notes', title: 'Open workspace: Notes' },
]
const ids = (query: string) => filterCommands(commands, query).map((c) => c.id)

describe('filterCommands', () => {
  it('returns everything in the original order for an empty or blank query', () => {
    expect(ids('')).toEqual(commands.map((c) => c.id))
    expect(ids('   ')).toEqual(commands.map((c) => c.id))
  })

  it('ranks titles that start with the query before titles that merely contain it', () => {
    expect(ids('fi')).toEqual(['fit', 'find'])
    expect(ids('note')).toEqual(['sticky', 'open-notes'])
  })

  it('matches a word inside the title and ignores letter case', () => {
    expect(ids('THEME')).toEqual(['theme'])
    expect(ids('light')).toEqual(['theme'])
  })

  it('matches hidden synonyms but ranks them after title matches', () => {
    expect(ids('picture')).toEqual(['image'])
    expect(ids('card')).toEqual(['sticky'])
  })

  it('requires every word of the query to match', () => {
    expect(ids('add image')).toEqual(['image'])
    expect(ids('add zebra')).toEqual([])
  })

  it('finds a workspace by its name after the colon', () => {
    expect(ids('notes')).toEqual(['open-notes'])
    expect(ids('workspace notes')).toEqual(['open-notes'])
  })

  it('returns nothing when nothing matches', () => {
    expect(ids('qqq')).toEqual([])
  })
})
