import { useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { BackupInfo } from '@/services/persistence/storage-adapter'
import { deleteBackupCopy, downloadBackup, restoreBackup } from '../../actions/transfer-actions'
import { useBackups } from '../../hooks/useBackups'
import { BackupRow } from './BackupRow'

function describeBackup(backup: BackupInfo, names: ReadonlyMap<string, string>): string {
  if (backup.kind === 'workspaces') return 'Workspace list'
  const name = backup.workspaceId ? names.get(backup.workspaceId) : undefined
  return name ? `Unreadable canvas of “${name}”` : 'Unreadable canvas of a workspace that is no longer listed'
}

export function RecoverySection() {
  const { state, reload } = useBackups()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const names = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]))

  const run = async (backup: BackupInfo, action: (info: BackupInfo) => Promise<unknown>) => {
    setBusyKey(backup.key)
    try {
      await action(backup)
    } finally {
      setBusyKey(null)
      reload()
    }
  }

  return (
    <section aria-labelledby="data-recovery-heading" className="space-y-3 border-t border-line pt-6">
      <h3 id="data-recovery-heading" className="font-display text-base font-semibold">
        Recovery copies
      </h3>
      <p className="text-sm leading-relaxed text-muted">
        When InfiniteSpace finds saved data it can&apos;t read (damaged, or written by a newer version), it keeps a copy
        here instead of overwriting it. Download a copy to keep it, or try to restore what can be understood.
      </p>
      {state.status === 'loading' && (
        <p role="status" className="text-sm text-muted">
          Looking for recovery copies…
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Recovery copies couldn&apos;t be read because browser storage is unavailable.
        </p>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          No recovery copies. They only appear if something unreadable is found.
        </p>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul className="space-y-2.5">
          {state.items.map((backup) => (
            <BackupRow
              key={backup.key}
              backup={backup}
              label={describeBackup(backup, names)}
              busy={busyKey !== null}
              onDownload={() => void run(backup, downloadBackup)}
              onRestore={() => void run(backup, restoreBackup)}
              onDelete={() => void run(backup, deleteBackupCopy)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
