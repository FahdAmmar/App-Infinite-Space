import { useState } from 'react'
import { FolderSync, HardDriveDownload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { describeBackupAge } from '@/services/backup/backup-policy'
import { useBackupStore } from '@/stores/backup-store'
import {
  backupNow,
  chooseBackupFolder,
  disconnectBackupFolder,
  isFolderBackupSupported,
  reconnectBackupFolder,
} from '../../actions/backup-actions'

/** النسخ الاحتياطي: مجلد تلقائي في Chromium، وتنزيل ملفات في غيره. */
export function BackupSection() {
  const { lastBackupAt, folderName, autoBackup, folderStatus, setAutoBackup } = useBackupStore()
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())
  const supported = isFolderBackupSupported()

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="data-backup-heading" className="space-y-3 border-t border-line pt-6">
      <h3 id="data-backup-heading" className="font-display text-base font-semibold">
        Backup
      </h3>
      <p className="text-sm leading-relaxed text-muted">
        Last backup: <span className="font-medium text-ink">{describeBackupAge(lastBackupAt, now)}</span>.{' '}
        {supported
          ? 'Pick a folder and InfiniteSpace keeps a file for every workspace there, updated while the app is open.'
          : "This browser can't write to a folder, so a backup downloads one file per workspace."}
      </p>

      {supported && folderName === null && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(chooseBackupFolder)}>
          <FolderSync className="size-4" aria-hidden="true" />
          Choose backup folder…
        </Button>
      )}

      {supported && folderName !== null && (
        <div className="space-y-3">
          <p className="text-sm">
            Folder: <span className="font-mono text-xs">{folderName}</span>
          </p>
          {folderStatus === 'needs-permission' ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">Automatic backups are paused until you allow access again.</p>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(reconnectBackupFolder)}>
                Reconnect folder
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={autoBackup} onChange={(event) => setAutoBackup(event.target.checked)} />
              Back up automatically while the app is open
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(backupNow)}>
              <HardDriveDownload className="size-4" aria-hidden="true" />
              Back up now
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(chooseBackupFolder)}>
              Change folder…
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(disconnectBackupFolder)}>
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {!supported && (
        <Button variant="secondary" size="sm" disabled={busy} aria-busy={busy} onClick={() => void run(backupNow)}>
          <HardDriveDownload className="size-4" aria-hidden="true" />
          {busy ? 'Downloading…' : 'Download all workspaces'}
        </Button>
      )}
    </section>
  )
}
