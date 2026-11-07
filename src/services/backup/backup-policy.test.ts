import { describe, expect, it } from 'vitest'
import { backupFileName, describeBackupAge, shouldRemindBackup, snoozeUntil } from './backup-policy'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const base = { now: NOW, workspaceCount: 2, lastBackupAt: null as number | null, oldestCreatedAt: NOW - 30 * DAY, snoozedUntil: 0 }

describe('shouldRemindBackup', () => {
  it('stays silent with nothing to lose', () => {
    expect(shouldRemindBackup({ ...base, workspaceCount: 0 })).toBe(false)
  })

  it('reminds when the oldest workspace is a week old and was never backed up', () => {
    expect(shouldRemindBackup(base)).toBe(true)
  })

  it('does not nag someone who created their first workspace a moment ago', () => {
    expect(shouldRemindBackup({ ...base, oldestCreatedAt: NOW - 2 * DAY })).toBe(false)
  })

  it('measures from the last backup when there is one', () => {
    expect(shouldRemindBackup({ ...base, lastBackupAt: NOW - 3 * DAY })).toBe(false)
    expect(shouldRemindBackup({ ...base, lastBackupAt: NOW - 8 * DAY })).toBe(true)
  })

  it('honours a snooze', () => {
    expect(shouldRemindBackup({ ...base, snoozedUntil: snoozeUntil(NOW) })).toBe(false)
    expect(shouldRemindBackup({ ...base, snoozedUntil: NOW - 1 })).toBe(true)
  })
})

describe('describeBackupAge', () => {
  it.each([
    [null, 'never'],
    [NOW - 1000, 'today'],
    [NOW - DAY, 'yesterday'],
    [NOW - 9 * DAY, '9 days ago'],
  ])('describes %s as %s', (at, text) => {
    expect(describeBackupAge(at, NOW)).toBe(text)
  })
})

describe('backupFileName', () => {
  it('is stable for a workspace and tells same-named workspaces apart', () => {
    const a = backupFileName({ id: 'abcdef12-3456', name: 'Product plan' })
    expect(a).toBe('product-plan-abcdef12.infinitespace.json')
    expect(backupFileName({ id: 'abcdef12-3456', name: 'Product plan' })).toBe(a)
    expect(backupFileName({ id: 'zzzz9999-0000', name: 'Product plan' })).not.toBe(a)
  })

  it('keeps Arabic names readable and never produces an empty stem', () => {
    expect(backupFileName({ id: 'abc12345', name: 'خطة المنتج' })).toBe('خطة-المنتج-abc12345.infinitespace.json')
    expect(backupFileName({ id: 'abc12345', name: '***' })).toBe('workspace-abc12345.infinitespace.json')
  })

  it('strips path separators and trims very long names', () => {
    const name = backupFileName({ id: 'abc12345', name: '../../etc/passwd ' + 'x'.repeat(100) })
    expect(name).not.toMatch(/[/\\]/)
    expect(name.length).toBeLessThanOrEqual(40 + '-abc12345.infinitespace.json'.length)
  })
})
