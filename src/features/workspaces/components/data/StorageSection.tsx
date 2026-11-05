import { useStorageEstimate } from '../../hooks/useStorageEstimate'
import { StorageUsageView } from './StorageUsageView'

export function StorageSection() {
  const { estimate, outcome, protect } = useStorageEstimate()
  return (
    <section aria-labelledby="data-storage-heading" className="space-y-3">
      <h3 id="data-storage-heading" className="font-display text-base font-semibold">
        Browser storage
      </h3>
      <StorageUsageView estimate={estimate} outcome={outcome} onProtect={() => void protect()} />
    </section>
  )
}
