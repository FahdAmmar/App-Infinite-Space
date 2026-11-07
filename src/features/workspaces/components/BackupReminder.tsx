import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { describeBackupAge, shouldRemindBackup, snoozeUntil } from '@/services/backup/backup-policy'
import { useBackupStore } from '@/stores/backup-store'
import type { WorkspaceMeta } from '../types/workspace'

interface BackupReminderProps {
  workspaces: readonly WorkspaceMeta[]
  /** الوقت الحالي من الصفحة (الحساب لا يُجرى أثناء التصيير) */
  now: number
  onOpenBackup: () => void
}

/** تذكير هادئ: البيانات في المتصفح فقط. يظهر بعد 7 أيام بلا نسخة ويمكن تأجيله 3 أيام. */
export function BackupReminder({ workspaces, now, onOpenBackup }: BackupReminderProps) {
  const { lastBackupAt, snoozedUntil, snooze } = useBackupStore()
  const oldest = workspaces.length === 0 ? null : Math.min(...workspaces.map((workspace) => workspace.createdAt))
  if (!shouldRemindBackup({ now, workspaceCount: workspaces.length, lastBackupAt, oldestCreatedAt: oldest, snoozedUntil })) return null

  return (
    <aside role="region" aria-label="Backup reminder" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface/70 px-4 py-3">
      <ShieldAlert className="size-5 shrink-0 text-accent" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        Your workspaces live only in this browser. Last backup: <strong className="font-medium">{describeBackupAge(lastBackupAt, now)}</strong>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onOpenBackup}>
          Back up
        </Button>
        <Button variant="ghost" size="sm" onClick={() => snooze(snoozeUntil(now))}>
          Remind me later
        </Button>
      </div>
    </aside>
  )
}
