import { Link } from 'react-router'
import { Command } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { LogoMark } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { SaveStatusPill } from './SaveStatusPill'
import { UndoRedoPill } from './UndoRedoPill'
import { WorkspaceTitle } from './WorkspaceTitle'

/**
 * شريط علوي عائم من حبوب منفصلة فوق اللوحة (مرجع 1)، فلا يحجز مساحة ولا يغطي اللوحة بشريط كامل:
 * زر الشعار (رجوع)، مسار "Workspaces / الاسم"، ثم حالة الحفظ والسمة.
 * الحاوية لا تلتقط الفأرة (pointer-events-none) كي تبقى اللوحة تحتها قابلة للسحب؛ الحبوب وحدها تلتقطها.
 */
export function EditorTopBar({ workspace }: { workspace: WorkspaceMeta }) {
  // أثناء العرض التقديمي يُخفى الشريط (invisible + inert: لا يُرى ولا يُركَّز عليه ولا تقرؤه قارئات الشاشة) دون إلغاء تركيبه،
  // فلا تُعاد حركة دخوله ولا يُفقد ما فيه (عنوان قيد التحرير مثلاً) عند العودة
  const presenting = useCanvasStore((state) => state.presentation !== null)
  const api = useCanvasStoreApi()
  return (
    <header
      inert={presenting}
      className={cn('pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4', presenting && 'invisible')}
    >
      <div data-reveal="top" className="pointer-events-auto flex min-w-0 items-center gap-2">
        <Link
          to="/"
          aria-label="Back to workspaces"
          title="Back to workspaces"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface shadow-pop transition-colors hover:bg-raised"
        >
          <LogoMark className="size-6" />
        </Link>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            className="hidden h-11 items-center rounded-full border border-line bg-surface px-4 text-sm text-muted shadow-pop transition-colors hover:text-ink sm:inline-flex"
          >
            Workspaces
          </Link>
          <WorkspaceTitle workspace={workspace} />
        </nav>
      </div>

      <div data-reveal="top" className="pointer-events-auto flex shrink-0 items-center gap-2">
        <UndoRedoPill />
        <SaveStatusPill />
        {/* لوحة الأوامر لمن لا لوحة مفاتيح عنده (Ctrl/⌘+K)؛ وعلى الهاتف تأخذ مكان زر السمة الذي صار أمراً فيها */}
        <div className="grid size-11 place-items-center rounded-full border border-line bg-surface shadow-pop">
          <IconButton label="Command palette (Ctrl/⌘+K)" onClick={() => api.getState().setPaletteOpen(true)} className="rounded-full">
            <Command className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="grid size-11 place-items-center rounded-full border border-line bg-surface shadow-pop max-sm:hidden">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
