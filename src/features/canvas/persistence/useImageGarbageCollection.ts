import { useEffect } from 'react'
import { imageStorage, storage } from '@/services/persistence'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { collectUnusedImages } from './image-gc'

/** تأخير بدء التنظيف بعد فتح التطبيق: ليس عملاً عاجلاً، ولا نريد منافسة التحميل الأول. */
const START_DELAY_MS = 8000

/** يشغّل تنظيف الصور غير المستخدمة مرة واحدة لكل فتح للتطبيق، بعد أن تُحمَّل المساحات. */
export function useImageGarbageCollection(): void {
  const ready = useWorkspaceStore((state) => state.status === 'ready')
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => void collectUnusedImages({ storage, images: imageStorage }), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ready])
}
