import { Panel } from '@xyflow/react'
import { ImagePlus, Layers, Link2, StickyNote, Type } from 'lucide-react'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import type { CanvasTool } from '../types/nodes'
import { ToolButton } from './ToolButton'

/**
 * الـ dock السفلي (مراجع 1 و4 و6): أدوات إضافة العناصر إلى اللوحة.
 * الملاحظة والنص والرابط والمجموعة أدوات تنتظر نقرة على اللوحة (الضغط على أداة مفعّلة يلغيها)،
 * أما الصورة فتفتح نافذة اختيار الملفات مباشرة لأنها لا تُنشأ دون ملف.
 */
export function CreationDock({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const activeTool = useCanvasStore((state) => state.tool)
  const choose = (tool: CanvasTool) => api.getState().setTool(tool === activeTool ? 'select' : tool)

  return (
    <Panel position="bottom-center">
      <div
        role="toolbar"
        aria-label="Add to canvas"
        data-reveal="bottom"
        className="flex items-center gap-1 rounded-[22px] border border-line bg-surface/90 p-1.5 shadow-pop backdrop-blur-md"
      >
        <ToolButton label="Sticky note" shortcut="N" icon={StickyNote} size="lg" active={activeTool === 'sticky'} tooltipSide="top" onSelect={() => choose('sticky')} />
        <ToolButton label="Text card" shortcut="T" icon={Type} size="lg" active={activeTool === 'text'} tooltipSide="top" onSelect={() => choose('text')} />
        <ToolButton label="Add image" shortcut="I" icon={ImagePlus} size="lg" active={false} tooltipSide="top" onSelect={() => void commands.pickAndAddImages('center')} />
        <ToolButton label="Link card" shortcut="L" icon={Link2} size="lg" active={activeTool === 'link'} tooltipSide="top" onSelect={() => choose('link')} />
        <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line" />
        <ToolButton label="Group" shortcut="G" icon={Layers} size="lg" active={activeTool === 'group'} tooltipSide="top" onSelect={() => choose('group')} />
      </div>
    </Panel>
  )
}
