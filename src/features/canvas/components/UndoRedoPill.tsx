import { Redo2, Undo2 } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'

/** تراجع وإعادة (مواصفات 4.6). الأزرار تتعطل حين لا يوجد ما يُتراجع عنه أو يُعاد. */
export function UndoRedoPill() {
  const api = useCanvasStoreApi()
  const canUndo = useCanvasStore((state) => state.canUndo)
  const canRedo = useCanvasStore((state) => state.canRedo)
  return (
    <div role="group" aria-label="History" className="flex h-11 items-center rounded-full border border-line bg-surface px-1 shadow-pop">
      <IconButton
        label="Undo (Ctrl/⌘+Z)"
        disabled={!canUndo}
        onClick={() => api.getState().undo()}
        className="size-9 rounded-full disabled:opacity-40"
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Redo (Ctrl/⌘+Shift+Z)"
        disabled={!canRedo}
        onClick={() => api.getState().redo()}
        className="size-9 rounded-full disabled:opacity-40"
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  )
}
