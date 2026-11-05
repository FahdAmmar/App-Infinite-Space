import { useState } from 'react'
import { ArchiveRestore, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatBytes } from '@/lib/bytes'
import { formatFullDate } from '@/lib/time'
import type { BackupInfo } from '@/services/persistence/storage-adapter'
import { TruncatedText } from '@/components/ui/TruncatedText'

interface BackupRowProps {
  backup: BackupInfo
  /** اسم مفهوم للمستخدم (مثل اسم المساحة) */
  label: string
  busy: boolean
  onDownload: () => void
  onRestore: () => void
  onDelete: () => void
}

/** صف نسخة احتياطية. الحذف نهائي، لذلك يحتاج نقرة تأكيد ثانية بدل نافذة كاملة. */
export function BackupRow({ backup, label, busy, onDownload, onRestore, onDelete }: BackupRowProps) {
  const [confirming, setConfirming] = useState(false)
  const details = [formatBytes(backup.sizeBytes), backup.createdAt ? formatFullDate(backup.createdAt) : null].filter(Boolean).join(' · ')

  return (
    <li className="space-y-2.5 rounded-2xl border border-line bg-surface p-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          <TruncatedText>{label}</TruncatedText>
        </p>
        <p className="text-xs text-muted">{details}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onDownload}>
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onRestore}>
          <ArchiveRestore className="size-4" aria-hidden="true" />
          {backup.kind === 'canvas' ? 'Restore as new workspace' : 'Restore workspaces'}
        </Button>
        {confirming ? (
          <>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => {
                setConfirming(false)
                onDelete()
              }}
            >
              Delete permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>
    </li>
  )
}
