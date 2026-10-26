import type { ImageStorage } from '@/services/persistence/image-storage'
import type { StorageAdapter } from '@/services/persistence/storage-adapter'
import { collectImageIds } from './canvas-codec'

/**
 * الصور التي أُضيفت منذ أقل من هذه المدة لا تُحذف أبداً حتى لو لم تُذكر في أي لوحة محفوظة:
 * قد تكون أُضيفت للتو في تبويب آخر ولم يُحفظ تعديله بعد، أو يحتاجها التراجع في جلسة طويلة مفتوحة.
 */
export const IMAGE_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000

export interface ImageGcResult {
  removed: number
  /** true إذا لم يُجرَ التنظيف لأن المراجع غير معروفة بيقين (قراءة فاشلة أو محتوى غير مقروء) */
  skipped: boolean
}

/**
 * يحذف ملفات الصور غير المذكورة في أي لوحة محفوظة (تتراكم عند حذف بطاقة صورة أو استبدالها أو حذف مساحة).
 *
 * قاعدة الأمان الأولى: الحذف لا رجعة فيه، لذا عند أي شك في قائمة المراجع — فشل قراءة مساحة أو لوحة،
 * أو محتوى غير مقروء قد يحوي صوراً لا نعرفها — لا نحذف شيئاً. صورة يتيمة تستهلك مساحة فقط،
 * أما حذف صورة مستخدمة فيُفسد لوحة المستخدم.
 */
export async function collectUnusedImages(deps: {
  storage: Pick<StorageAdapter, 'loadWorkspaces' | 'loadCanvas'>
  images: Pick<ImageStorage, 'list' | 'remove'>
  now?: number
  graceMs?: number
}): Promise<ImageGcResult> {
  const now = deps.now ?? Date.now()
  const graceMs = deps.graceMs ?? IMAGE_ORPHAN_GRACE_MS

  try {
    const workspaces = await deps.storage.loadWorkspaces()
    if (workspaces.unreadable) return { removed: 0, skipped: true }

    const referenced = new Set<string>()
    for (const workspace of workspaces.workspaces) {
      const loaded = await deps.storage.loadCanvas(workspace.id)
      if (loaded.unreadable) return { removed: 0, skipped: true }
      if (loaded.canvas) for (const id of collectImageIds(loaded.canvas)) referenced.add(id)
    }

    const stored = await deps.images.list()
    let removed = 0
    for (const image of stored) {
      if (referenced.has(image.id) || now - image.createdAt < graceMs) continue
      await deps.images.remove(image.id)
      removed += 1
    }
    return { removed, skipped: false }
  } catch {
    return { removed: 0, skipped: true }
  }
}
