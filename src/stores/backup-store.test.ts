// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useBackupStore } from './backup-store'

const KEY = 'infinitespace:v1:backup'

beforeEach(() => {
  localStorage.clear()
  useBackupStore.setState({ lastBackupAt: null, snoozedUntil: 0, folderName: null, autoBackup: false, folderStatus: 'none' })
})

describe('backup store', () => {
  it('persists the last backup and snooze', () => {
    useBackupStore.getState().recordBackup(123)
    useBackupStore.getState().snooze(456)
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({ lastBackupAt: 123, snoozedUntil: 456 })
  })

  it('turns automatic backup off and forgets the folder status when the folder is disconnected', () => {
    const store = useBackupStore.getState()
    store.setFolder('Backups')
    store.setAutoBackup(true)
    store.setFolderStatus('ready')
    useBackupStore.getState().setFolder(null)
    expect(useBackupStore.getState()).toMatchObject({ folderName: null, autoBackup: false, folderStatus: 'none' })
  })

  it('never persists the per-session folder status', () => {
    useBackupStore.getState().setFolderStatus('ready')
    useBackupStore.getState().recordBackup(1)
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('folderStatus')
  })
})
