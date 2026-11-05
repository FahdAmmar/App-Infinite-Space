import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/bytes'
import type { PersistOutcome, StorageEstimateResult } from '@/services/persistence/storage-estimate'

interface StorageUsageViewProps {
  /** null أثناء القياس */
  estimate: StorageEstimateResult | null
  outcome: PersistOutcome | null
  onProtect: () => void
}

/** عرض استخدام التخزين (بلا منطق): يُختبر مباشرة، والحاوية StorageSection تغذّيه بالبيانات. */
export function StorageUsageView({ estimate, outcome, onProtect }: StorageUsageViewProps) {
  if (estimate === null) {
    return (
      <p role="status" className="text-sm text-muted">
        Checking storage…
      </p>
    )
  }
  if (!estimate.supported) {
    return <p className="text-sm text-muted">Your browser doesn&apos;t report how much storage is in use.</p>
  }

  const percent = Math.round(estimate.ratio * 100)
  return (
    <div className="space-y-3">
      <div
        role="meter"
        aria-label="Browser storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% used`}
        className="h-2.5 overflow-hidden rounded-full bg-raised"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', estimate.level === 'critical' ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${Math.max(percent, estimate.usage > 0 ? 1 : 0)}%` }}
        />
      </div>
      <p className="text-sm">
        <span className="font-medium">{formatBytes(estimate.usage)}</span>
        <span className="text-muted"> of {formatBytes(estimate.quota)} used ({percent}%)</span>
      </p>
      <p className="text-xs leading-relaxed text-muted">
        The browser reports this for all of this site&apos;s data, and rounds it, so treat it as an estimate.
      </p>

      {estimate.level !== 'ok' && (
        <p role="status" className={cn('text-sm leading-relaxed', estimate.level === 'critical' ? 'text-danger' : 'text-ink')}>
          {estimate.level === 'critical'
            ? 'Storage is almost full, so new changes may fail to save. Export workspaces you want to keep, then delete ones you no longer need.'
            : 'Storage is getting full. Consider exporting workspaces you want to keep.'}
        </p>
      )}

      {estimate.persisted === true && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          Protected: your browser won&apos;t clear this data on its own when space runs low.
        </p>
      )}
      {estimate.persisted === false && outcome !== 'unsupported' && (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted">
            Browsers may clear a site&apos;s data when the device runs low on space. You can ask yours to protect it.
          </p>
          <Button variant="secondary" size="sm" onClick={onProtect}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            Protect my data
          </Button>
          {outcome === 'denied' && (
            <p role="status" className="text-sm leading-relaxed text-muted">
              Your browser declined the request. It decides this on its own, so you can try again later. Exporting your
              workspaces is the safest backup.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
