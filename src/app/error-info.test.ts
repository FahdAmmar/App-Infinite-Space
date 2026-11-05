import { describe, expect, it } from 'vitest'
import { describeError } from './error-info'

describe('describeError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x.test/assets/Editor-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/Editor.css',
    'Loading chunk 42 failed.',
  ])('recognizes the lazy-load failure "%s" from any browser', (message) => {
    const summary = describeError(new TypeError(message))
    expect(summary.kind).toBe('chunk')
    expect(summary.message).toMatch(/Reload/)
  })

  it('describes an ordinary error as unknown and keeps its message as detail', () => {
    const summary = describeError(new Error('Cannot read properties of undefined'))
    expect(summary.kind).toBe('unknown')
    expect(summary.detail).toBe('Cannot read properties of undefined')
  })

  it('never leaks the stack, only the message', () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at secretFunction (/internal/path.ts:1:1)'
    expect(describeError(error).detail).not.toContain('secretFunction')
  })

  it('accepts strings, objects and nothing at all', () => {
    expect(describeError('404 Not Found').detail).toBe('404 Not Found')
    expect(describeError({ weird: true }).detail).toBe('Unknown error')
    expect(describeError(undefined).detail).toBe('Unknown error')
  })

  it('truncates a very long message', () => {
    expect(describeError(new Error('x'.repeat(5000))).detail).toHaveLength(300)
  })
})
