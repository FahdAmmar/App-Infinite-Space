import { describe, expect, it } from 'vitest'
import { buildCardLink, parseCardParam } from './card-link'

describe('buildCardLink', () => {
  it('builds a workspace path with the card as a query parameter', () => {
    expect(buildCardLink('https://app.example', 'ws-1', 'abcd1234-ef56')).toBe('https://app.example/w/ws-1?card=abcd1234-ef56')
  })

  it('encodes unusual characters so the link cannot inject extra parameters', () => {
    const link = buildCardLink('https://app.example', 'a/b', 'x&y=z')
    expect(link).toBe('https://app.example/w/a%2Fb?card=x%26y%3Dz')
    expect(new URL(link).searchParams.get('card')).toBe('x&y=z')
  })
})

describe('parseCardParam', () => {
  it('accepts a UUID and a 32-character hex id', () => {
    expect(parseCardParam('3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b')).toBe('3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b')
    expect(parseCardParam('0123456789abcdef0123456789abcdef')).toBe('0123456789abcdef0123456789abcdef')
  })

  it('rejects missing, too short, too long and unsafe values', () => {
    expect(parseCardParam(null)).toBeNull()
    expect(parseCardParam('')).toBeNull()
    expect(parseCardParam('short')).toBeNull()
    expect(parseCardParam('a'.repeat(65))).toBeNull()
    expect(parseCardParam('<script>alert(1)</script>')).toBeNull()
    expect(parseCardParam('abcd1234 efgh5678')).toBeNull()
    expect(parseCardParam('../../etc/passwd')).toBeNull()
  })
})
