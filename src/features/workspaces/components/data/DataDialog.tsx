import { Dialog } from '@/components/ui/Dialog'
import { BackupSection } from './BackupSection'
import { ImportSection } from './ImportSection'
import { RecoverySection } from './RecoverySection'
import { StorageSection } from './StorageSection'

interface DataDialogProps {
  open: boolean
  onClose: () => void
}

/** مركز البيانات: مساحة التخزين، استيراد ملف، ونسخ الاسترجاع. (التصدير من قائمة ⋯ في بطاقة كل مساحة.) */
export function DataDialog({ open, onClose }: DataDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Data & backup"
      description="Your workspaces live only in this browser. Back them up to a folder, or export a workspace from its ⋯ menu, to keep a copy you control."
    >
      <div className="space-y-6">
        <StorageSection />
        <BackupSection />
        <ImportSection />
        <RecoverySection />
      </div>
    </Dialog>
  )
}
