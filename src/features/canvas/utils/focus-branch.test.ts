import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { createEdge } from './edge-utils'
import { collectBranch, countBranch, resolveFocus, viewDimming } from './focus-branch'
import { createGroup, createStickyNote } from './node-factory'

const note = (id: string, tags: string[] = []): CanvasNode => {
  const sticky = createStickyNote({ x: 0, y: 0 }, 1)
  return { ...sticky, id, data: { ...sticky.data, tags } }
}
const group: CanvasNode = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
const link = (source: string, target: string): CanvasEdge => ({ ...createEdge(source, target, 'right', 'left'), id: `${source}-${target}` })

describe('collectBranch', () => {
  // A → B → C, D → B, B → E, D → F (F is only a sibling of B, reached through D)
  const edges = [link('a', 'b'), link('b', 'c'), link('d', 'b'), link('b', 'e'), link('d', 'f')]

  it('contains the card, everything upstream and everything downstream', () => {
    expect([...collectBranch(edges, 'b')].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('leaves out siblings reached only through a shared ancestor', () => {
    expect(collectBranch(edges, 'b').has('f')).toBe(false)
  })

  it('follows only one direction from a leaf and from a root', () => {
    expect([...collectBranch(edges, 'c')].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect([...collectBranch(edges, 'a')].sort()).toEqual(['a', 'b', 'c', 'e'])
  })

  it('is just the card itself when it has no connections', () => {
    expect([...collectBranch(edges, 'z')]).toEqual(['z'])
  })

  it('terminates on a cycle', () => {
    const cyclic = [link('a', 'b'), link('b', 'c'), link('c', 'a')]
    expect([...collectBranch(cyclic, 'a')].sort()).toEqual(['a', 'b', 'c'])
  })

  it('handles a long chain without recursion limits', () => {
    const chain = Array.from({ length: 5000 }, (_, i) => link(`n${i}`, `n${i + 1}`))
    expect(collectBranch(chain, 'n2500').size).toBe(5001)
  })
})

describe('resolveFocus', () => {
  const nodes = [note('a'), note('b')]
  const edges = [link('a', 'b')]

  it('returns null without a focus or when the focused card no longer exists', () => {
    expect(resolveFocus(nodes, edges, null)).toBeNull()
    expect(resolveFocus(nodes, edges, 'deleted')).toBeNull()
  })

  it('returns the branch of an existing card', () => {
    expect([...(resolveFocus(nodes, edges, 'a') ?? [])].sort()).toEqual(['a', 'b'])
  })
})

describe('countBranch', () => {
  it('counts cards in the branch and in total, ignoring groups', () => {
    const nodes = [note('a'), note('b'), note('c'), group]
    expect(countBranch(nodes, new Set(['a', 'b', 'g']))).toEqual({ inBranch: 2, total: 3 })
  })
})

describe('viewDimming', () => {
  const a = note('a', ['x'])
  const b = note('b', ['y'])

  it('is null when neither a tag nor a focus is active', () => {
    expect(viewDimming(null, null)).toBeNull()
  })

  it('dims by tag alone, or by branch alone, never dimming groups', () => {
    expect(viewDimming('x', null)?.(b)).toBe(true)
    expect(viewDimming('x', null)?.(a)).toBe(false)
    expect(viewDimming(null, new Set(['a']))?.(b)).toBe(true)
    expect(viewDimming(null, new Set(['a']))?.(a)).toBe(false)
    expect(viewDimming('x', new Set(['a']))?.(group)).toBe(false)
  })

  it('dims a card when either filter excludes it', () => {
    const both = viewDimming('x', new Set(['a', 'b']))
    expect(both?.(a)).toBe(false)
    expect(both?.(b)).toBe(true) // in the branch but without the tag
    expect(viewDimming('x', new Set(['b']))?.(a)).toBe(true) // has the tag but outside the branch
  })
})
