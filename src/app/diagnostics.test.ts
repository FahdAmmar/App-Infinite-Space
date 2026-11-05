import { describe, expect, it } from 'vitest'
import { buildDiagnostics, describePath, type DiagnosticsInput } from './diagnostics'

const input: DiagnosticsInput = {
  detail: 'Failed to fetch dynamically imported module',
  appVersion: '0.1.0',
  userAgent: 'TestBrowser/1.0',
  language: 'en-US',
  viewport: { width: 1440, height: 900 },
  online: true,
  theme: 'dark',
  now: new Date('2026-11-01T10:00:00Z'),
}

describe('describePath', () => {
  it('hides the workspace id but keeps the page kind', () => {
    expect(describePath('/w/3dddad2c-d4af-4541-ad7d-9d5ebcd6b2bb')).toBe('/w/<workspace>')
    expect(describePath('/')).toBe('/')
  })
})

describe('buildDiagnostics', () => {
  const text = buildDiagnostics(input, '/w/3dddad2c-d4af-4541-ad7d-9d5ebcd6b2bb')

  it('lists the facts a bug report needs', () => {
    expect(text).toContain('Version: 0.1.0')
    expect(text).toContain('Error: Failed to fetch dynamically imported module')
    expect(text).toContain('Viewport: 1440x900')
    expect(text).toContain('Online: yes')
    expect(text).toContain('Time: 2026-11-01T10:00:00.000Z')
  })

  it('never includes the workspace id', () => {
    expect(text).not.toContain('3dddad2c')
    expect(text).toContain('Page: /w/<workspace>')
  })
})
