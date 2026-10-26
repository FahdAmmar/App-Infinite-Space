import { ChevronDown, ChevronUp, Spline } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button, IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { selectSelectedEdgeIds, selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import { EdgeProperties } from './properties/EdgeProperties'
import { NodePanelTitle, NodeProperties } from './properties/NodeProperties'
import { PanelSection } from './properties/controls'

/**
 * لوحة الخصائص العائمة (مواصفات 5): تظهر عند تحديد عنصر واحد (عقدة أو وصلة) أو عدة عناصر (ملخص وإجراءات)،
 * وتُطوى لتوسيع اللوحة. على الجوال تصبح ورقة سفلية. تُخفى أثناء التحرير المضمّن كي لا يتعارض محرّران على الحقل نفسه.
 */
export function PropertiesPanel({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const nodeIds = useCanvasStore(useShallow(selectSelectedIds))
  const edgeIds = useCanvasStore(useShallow(selectSelectedEdgeIds))
  const collapsed = useCanvasStore((state) => state.panelCollapsed)
  const isEditing = useCanvasStore((state) => state.editingNodeId !== null)
  const node = useCanvasStore((state) => (nodeIds.length === 1 && edgeIds.length === 0 ? state.nodes.find((n) => n.id === nodeIds[0]) : undefined))
  const edge = useCanvasStore((state) => (edgeIds.length === 1 && nodeIds.length === 0 ? state.edges.find((e) => e.id === edgeIds[0]) : undefined))

  const total = nodeIds.length + edgeIds.length
  if (total === 0 || isEditing) return null

  return (
    <aside
      aria-label="Properties"
      className={cn(
        'properties-panel absolute z-[6] flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface/95 shadow-pop backdrop-blur-md',
        'top-[76px] right-3 w-72 max-h-[calc(100dvh-26rem)] min-h-40',
        'max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-[88px] max-sm:w-auto max-sm:max-h-[48dvh]',
      )}
    >
      <header className="flex shrink-0 items-center gap-2.5 px-4 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
          {node ? (
            <NodePanelTitle type={node.type} />
          ) : edge ? (
            <>
              <Spline className="size-4" aria-hidden="true" />
              <span className="truncate">Connection</span>
            </>
          ) : (
            <span>{total} items selected</span>
          )}
        </span>
        <IconButton
          label={collapsed ? 'Expand properties' : 'Collapse properties'}
          aria-expanded={!collapsed}
          onClick={() => api.getState().togglePanel()}
          className="size-8"
        >
          {collapsed ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </IconButton>
      </header>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line overscroll-contain">
          {node ? (
            <NodeProperties node={node} commands={commands} />
          ) : edge ? (
            <EdgeProperties edge={edge} onDelete={commands.deleteSelection} />
          ) : (
            <PanelSection title="Selection">
              <p className="text-xs leading-relaxed text-muted">Select a single item to edit its properties.</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={commands.duplicateSelection}>
                  Duplicate
                </Button>
                <Button variant="secondary" size="sm" onClick={commands.deleteSelection} className="hover:text-danger">
                  Delete
                </Button>
              </div>
            </PanelSection>
          )}
        </div>
      )}
    </aside>
  )
}
