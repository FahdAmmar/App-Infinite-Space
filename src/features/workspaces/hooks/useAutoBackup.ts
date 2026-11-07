import { useEffect } from 'react'
import { autoBackupTick, refreshFolderStatus } from '../actions/backup-actions'

/** مدة بين نبضتين: تعديلات اللوحة تُحفظ في المتصفح فوراً، والنسخة الخارجية لا تحتاج أكثر من هذا */
const TICK_MS = 5 * 60 * 1000

/** عند الفتح نتحقق من إذن المجلد المحفوظ، ثم ننسخ المتغيّر كل بضع دقائق والتبويب ظاهر. */
export function useAutoBackup(): void {
  useEffect(() => {
    void refreshFolderStatus()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void autoBackupTick()
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [])
}
