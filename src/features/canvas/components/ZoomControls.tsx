import { Panel, useStore } from '@xyflow/react'
import { CircleHelp, Focus, Grid3x3, Map as MapIcon, Maximize, Minus, Plus, Search } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { selectSelectedCount } from '@/stores/canvas-selectors'
import { useUiStore } from '@/stores/ui-store'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'

function Divider() {
  // على شاشة ضيقة تلتف المجموعتان في صفين، فيفقد الفاصل معناه فنخفيه
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-line max-sm:hidden" />
}

/**
 * مجموعة التحكم أسفل اليمين (مراجع 1 و4 و5): مساعدة، خريطة مصغّرة، ملاءمة، تمركز، ثم التكبير بالنسبة.
 * تحت 1100px تُرفع فوق الـ dock كي لا يتداخلا (بعد إضافة البحث والشبكة تعدّى عرضها نصف المتاح عند 1024px).
 * على الهاتف نخفي زر الاختصارات والشبكة (أدوات لوحة مفاتيح ودقة مؤشر) فتبقى المجموعة في صف واحد بدل صفين
 * كانا يأخذان نحو 22% من ارتفاع الشاشة (433px عرضاً كانت تُقصّ خارج شاشة 390px، فصارت تلتف).
 */
export function ZoomControls({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  // نسبة التكبير كعدد صحيح: يتغير الاشتراك فقط عند تغيّر الرقم الظاهر
  const zoomPercent = useStore((state) => Math.round(state.transform[2] * 100))
  const hasSelection = useCanvasStore((state) => selectSelectedCount(state) > 0)
  const minimapVisible = useCanvasStore((state) => state.minimapVisible)
  const snapToGrid = useUiStore((state) => state.snapToGrid)

  return (
    <Panel position="bottom-right" className="max-[1100px]:mb-[84px]!">
      <div
        role="toolbar"
        aria-label="Zoom and view"
        className="flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-0.5 rounded-[18px] border border-line bg-surface/90 p-1 shadow-pop backdrop-blur-md"
      >
        <div className="flex items-center gap-0.5">
          <IconButton label="Find on canvas (Ctrl/⌘+F)" onClick={() => api.getState().setFindOpen(true)} className="size-9">
            <Search className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Keyboard shortcuts (?)" onClick={() => api.getState().setShortcutsOpen(true)} className="size-9 max-sm:hidden">
            <CircleHelp className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={minimapVisible ? 'Hide minimap' : 'Show minimap'}
            aria-pressed={minimapVisible}
            onClick={() => api.getState().toggleMinimap()}
            className={cn('size-9', minimapVisible && 'bg-raised text-ink')}
          >
            <MapIcon className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={snapToGrid ? 'Turn off snap to grid' : 'Turn on snap to grid'}
            aria-pressed={snapToGrid}
            onClick={() => useUiStore.getState().setSnapToGrid(!snapToGrid)}
            className={cn('size-9 max-sm:hidden', snapToGrid && 'bg-raised text-ink')}
          >
            <Grid3x3 className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Fit all content (Shift+1)" onClick={commands.fitAll} className="size-9">
            <Maximize className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Zoom to selection (Shift+2)"
            onClick={commands.centerOnSelection}
            disabled={!hasSelection}
            className="size-9"
          >
            <Focus className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <Divider />
        <div className="flex items-center gap-0.5">
          <IconButton label="Zoom out (−)" onClick={commands.zoomOut} className="size-9">
            <Minus className="size-4" aria-hidden="true" />
          </IconButton>
          <button
            type="button"
            onClick={commands.resetZoom}
            aria-label={`Zoom ${zoomPercent}%. Reset to 100%`}
            title="Reset zoom to 100%"
            className="h-9 min-w-14 rounded-xl px-2 font-mono text-xs text-ink transition-colors hover:bg-raised max-sm:min-w-12"
          >
            {zoomPercent}%
          </button>
          <IconButton label="Zoom in (+)" onClick={commands.zoomIn} className="size-9">
            <Plus className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </Panel>
  )
}
