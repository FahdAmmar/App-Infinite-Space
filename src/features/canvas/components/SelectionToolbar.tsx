import { NodeToolbar, Position } from '@xyflow/react'
import { Copy, Spline, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { STICKY_COLOR_IDS } from '../types/nodes'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import { STICKY_COLORS } from '../utils/constants'

/**
 * شريط إجراءات عائم فوق العقدة المحددة (أو فوق مجموعة المحددات):
 * ألوان الورقة أو المجموعة (عند تحديد واحدة منهما)، وصل، تكرار، حذف.
 * يُخفى أثناء تحرير النص حتى لا يغطي ما يكتبه المستخدم.
 */
export function SelectionToolbar({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  // useShallow: المحدد يعيد مصفوفة جديدة كل مرة، وهذا يقارنها عنصراً بعنصر لمنع حلقة إعادة الرسم
  const ids = useCanvasStore(useShallow(selectSelectedIds))
  const isEditing = useCanvasStore((state) => state.editingNodeId !== null)
  const single = useCanvasStore((state) => (ids.length === 1 ? state.nodes.find((node) => node.id === ids[0]) : undefined))

  if (ids.length === 0 || isEditing) return null

  const colorable = single?.type === 'sticky' || single?.type === 'group' ? single : undefined
  const activeColor = colorable ? colorable.data.color : null
  const plural = ids.length > 1

  return (
    <NodeToolbar nodeId={ids} isVisible position={Position.Top} offset={16}>
      <div
        role="toolbar"
        aria-label={plural ? `Actions for ${ids.length} selected items` : 'Actions for the selected item'}
        className="nodrag nopan flex items-center gap-1 rounded-2xl border border-line bg-raised p-1.5 shadow-pop"
      >
        {colorable && (
          <>
            <div role="group" aria-label="Note color" className="flex items-center gap-1 px-1">
              {STICKY_COLOR_IDS.map((colorId) => (
                <button
                  key={colorId}
                  type="button"
                  aria-label={STICKY_COLORS[colorId].label}
                  aria-pressed={activeColor === colorId}
                  title={STICKY_COLORS[colorId].label}
                  onClick={() =>
                    colorable.type === 'sticky'
                      ? api.getState().updateNodeData(colorable.id, 'sticky', { color: colorId })
                      : api.getState().updateNodeData(colorable.id, 'group', { color: colorId })
                  }
                  style={{ backgroundColor: STICKY_COLORS[colorId].bg, borderColor: STICKY_COLORS[colorId].border }}
                  className={cn(
                    'size-6 rounded-full border-2 transition-transform hover:scale-110',
                    activeColor === colorId && 'ring-2 ring-ink ring-offset-2 ring-offset-raised',
                  )}
                />
              ))}
            </div>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
          </>
        )}
        {single && single.type !== 'group' && (
          <IconButton label="Connect to another item (C)" onClick={() => commands.startConnectFrom(single.id)} className="size-9">
            <Spline className="size-4" aria-hidden="true" />
          </IconButton>
        )}
        <IconButton label="Duplicate (Ctrl/⌘+D)" onClick={commands.duplicateSelection} className="size-9">
          <Copy className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Delete (Del)" onClick={commands.deleteSelection} className="size-9 hover:text-danger">
          <Trash2 className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    </NodeToolbar>
  )
}
