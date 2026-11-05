import { Dialog } from '@/components/ui/Dialog'
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
      description="Your workspaces live only in this browser. Export a workspace from its ⋯ menu to keep a copy you control."
    >
      <div className="space-y-6">
        <StorageSection />
        <ImportSection />
        <RecoverySection />
      </div>
    </Dialog>
  )
}
