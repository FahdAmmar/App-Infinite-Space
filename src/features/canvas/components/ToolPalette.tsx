import { Panel } from '@xyflow/react'
import { Hand, MousePointer2, Spline } from 'lucide-react'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { ToolButton } from './ToolButton'

/** الشريط العمودي على اليسار (مرجع 1): أدوات التفاعل مع اللوحة (تحديد/يد/وصل). أدوات الإنشاء في CreationDock. */
export function ToolPalette() {
  const api = useCanvasStoreApi()
  const tool = useCanvasStore((state) => state.tool)

  return (
    <Panel position="center-left">
      <div
        role="toolbar"
        data-reveal="left"
        aria-label="Canvas tools"
        aria-orientation="vertical"
        className="flex flex-col items-center gap-1 rounded-[20px] border border-line bg-surface/90 p-1.5 shadow-pop backdrop-blur-md"
      >
        <ToolButton
          label="Select and move"
          shortcut="V"
          icon={MousePointer2}
          active={tool === 'select'}
          tooltipSide="right"
          onSelect={() => api.getState().setTool('select')}
        />
        <ToolButton
          label="Hand (pan only)"
          shortcut="H"
          icon={Hand}
          active={tool === 'hand'}
          tooltipSide="right"
          onSelect={() => api.getState().setTool('hand')}
        />
        <ToolButton
          label="Connect two items"
          shortcut="C"
          icon={Spline}
          active={tool === 'connect'}
          tooltipSide="right"
          onSelect={() => api.getState().setTool(tool === 'connect' ? 'select' : 'connect')}
        />
      </div>
    </Panel>
  )
}
