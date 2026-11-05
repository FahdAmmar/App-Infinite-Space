import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { usePersistence } from '../persistence/persistence-context'

/**
 * لافتة تعارض التبويبات: تظهر حين حفظ تبويب آخر هذه المساحة بعد أن فتحناها. الحفظ هنا موقوف تلقائياً،
 * والمستخدم يقرر صراحة: تحميل الأحدث (يتجاهل ما لم يُحفظ هنا) أو الإبقاء على نسخة هذا التبويب (تحل محل الأخرى).
 * role="alert": يقاطع قارئ الشاشة لأن الحفظ متوقف ويحتاج قراراً.
 */
export function ExternalChangeBanner() {
  const { externalChange, keepMine, reloadLatest } = usePersistence()
  if (!externalChange) return null

  return (
    <div
      role="alert"
      className="absolute inset-x-3 top-[4.5rem] z-30 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-danger/60 bg-raised p-4 shadow-pop sm:flex-row sm:items-center sm:gap-4"
    >
      <TriangleAlert className="hidden size-5 shrink-0 text-danger sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">This workspace was changed in another tab.</p>
        <p className="text-sm leading-relaxed text-muted">
          Saving is paused here so nothing gets overwritten. Load the latest version (unsaved changes in this tab are
          discarded), or keep this tab&apos;s version (your next save replaces the other tab&apos;s changes).
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={reloadLatest}>
          Load latest
        </Button>
        <Button variant="secondary" size="sm" onClick={keepMine}>
          Keep this version
        </Button>
      </div>
    </div>
  )
}
