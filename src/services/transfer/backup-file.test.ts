import { describe, expect, it } from 'vitest'
import { backupFileName, backupToText } from './backup-file'

describe('backupToText', () => {
  it('keeps raw text untouched, even when it is damaged', () => {
    expect(backupToText('{"broken":')).toBe('{"broken":')
  })

  it('pretty-prints stored objects', () => {
    expect(backupToText({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
})

describe('backupFileName', () => {
  it('uses .json for valid JSON and .txt for damaged text', () => {
    const info = { kind: 'canvas', workspaceId: 'abc', createdAt: null } as const
    expect(backupFileName(info, '{"ok":true}')).toBe('infinitespace-backup-canvas-abc-copy.json')
    expect(backupFileName(info, '{"broken":')).toBe('infinitespace-backup-canvas-abc-copy.txt')
  })

  it('includes the date for a dated workspace-list backup', () => {
    const info = { kind: 'workspaces', workspaceId: null, createdAt: Date.UTC(2026, 9, 27) } as const
    expect(backupFileName(info, '{}')).toBe('infinitespace-backup-workspaces-2026-10-27.json')
  })

  it('strips unsafe characters from the workspace id', () => {
    const info = { kind: 'canvas', workspaceId: '../../etc/passwd', createdAt: null } as const
    expect(backupFileName(info, '{}')).not.toMatch(/[./\\]{2}|\/|\\/)
  })
})
