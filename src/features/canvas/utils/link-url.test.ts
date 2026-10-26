import { describe, expect, it } from 'vitest'
import { URL_MAX_LENGTH } from './constants'
import { getDisplayHost, normalizeUrl } from './link-url'

describe('normalizeUrl', () => {
  it('accepts http and https addresses', () => {
    expect(normalizeUrl('https://example.com/page?q=1')).toBe('https://example.com/page?q=1')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
    expect(normalizeUrl('  www.example.com/a  ')).toBe('https://www.example.com/a')
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000/')
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com',
    'mailto:a@b.com',
    'blob:https://example.com/uuid',
  ])('rejects the non-web scheme %s', (input) => {
    expect(normalizeUrl(input)).toBeNull()
  })

  it('rejects addresses with embedded credentials (a phishing trick)', () => {
    expect(normalizeUrl('https://bank.com@evil.com')).toBeNull()
    expect(normalizeUrl('https://user:pass@example.com')).toBeNull()
  })

  it('rejects empty, spaced and oversized input', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(normalizeUrl('exa mple.com')).toBeNull()
    expect(normalizeUrl(`https://example.com/${'a'.repeat(URL_MAX_LENGTH)}`)).toBeNull()
  })

  it('rejects text that is not an address', () => {
    expect(normalizeUrl('http://')).toBeNull()
    expect(normalizeUrl('https://')).toBeNull()
  })
})

describe('getDisplayHost', () => {
  it('returns the host without www', () => {
    expect(getDisplayHost('https://www.example.com/a/b')).toBe('example.com')
    expect(getDisplayHost('https://docs.example.com/')).toBe('docs.example.com')
  })

  it('falls back to the input when it cannot be parsed', () => {
    expect(getDisplayHost('not a url')).toBe('not a url')
  })
})
