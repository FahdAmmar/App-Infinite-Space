import { useEffect, useState } from 'react'
import { Panel } from '@xyflow/react'
import { ImagePlus, Layers, Link2, ListChecks, Plus, Shapes, StickyNote, Type } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import type { CanvasTool } from '../types/nodes'
import { ToolButton } from './ToolButton'

/**
 * الـ dock السفلي (مراجع 1 و4 و6): أدوات إضافة العناصر إلى اللوحة.
 * الملاحظة والنص والرابط والمجموعة أدوات تنتظر نقرة على اللوحة (الضغط على أداة مفعّلة يلغيها)،
 * أما الصورة فتفتح نافذة اختيار الملفات مباشرة لأنها لا تُنشأ دون ملف.
 *
 * على الشاشات الضيقة (أقل من 900px) يُستبدل الشريط ذو الأزرار السبعة بزر «+» واحد يفتح القائمة نفسها: يوفّر صفاً كاملاً
 * من الشاشة الضيقة (كان الـ dock وشريط التكبير معاً يأخذان نحو خُمس الارتفاع) ويبقى الوصول للأدوات بنقرتين.
 */
/** عرض الشاشة الذي يُستبدل تحته الشريط بقائمة «+»؛ يُرفع إن زاد عدد الأدوات (انظر e2e/_common.py) */
const COMPACT_DOCK_QUERY = '(max-width: 899px)'

export function CreationDock({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const activeTool = useCanvasStore((state) => state.tool)
  // الشريط بسبعة أزرار يبلغ نحو 350px وسط الشاشة؛ تحت 900px يلامس لوحة البداية السريعة (يسار) فننتقل إلى قائمة «+» المضغوطة
  const phone = useMediaQuery(COMPACT_DOCK_QUERY)
  const [open, setOpen] = useState(false)
  const menuOpen = phone && open

  // Esc يغلق القائمة المفتوحة (لوحة مفاتيح خارجية مع الهاتف أو اللوحي)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const choose = (tool: CanvasTool) => {
    api.getState().setTool(tool === activeTool ? 'select' : tool)
    setOpen(false)
  }

  const tools = (
    <>
      <ToolButton label="Sticky note" shortcut="N" icon={StickyNote} size="lg" active={activeTool === 'sticky'} tooltipSide="top" onSelect={() => choose('sticky')} />
      <ToolButton label="Text card" shortcut="T" icon={Type} size="lg" active={activeTool === 'text'} tooltipSide="top" onSelect={() => choose('text')} />
      <ToolButton label="Add image" shortcut="I" icon={ImagePlus} size="lg" active={false} tooltipSide="top" onSelect={() => { setOpen(false); void commands.pickAndAddImages('center') }} />
      <ToolButton label="Link card" shortcut="L" icon={Link2} size="lg" active={activeTool === 'link'} tooltipSide="top" onSelect={() => choose('link')} />
      <ToolButton label="Checklist" shortcut="K" icon={ListChecks} size="lg" active={activeTool === 'checklist'} tooltipSide="top" onSelect={() => choose('checklist')} />
      <ToolButton label="Shape" shortcut="S" icon={Shapes} size="lg" active={activeTool === 'shape'} tooltipSide="top" onSelect={() => choose('shape')} />
      <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line" />
      <ToolButton label="Group" shortcut="G" icon={Layers} size="lg" active={activeTool === 'group'} tooltipSide="top" onSelect={() => choose('group')} />
    </>
  )
  const barClass = 'flex items-center gap-1 rounded-[22px] border border-line bg-surface/90 p-1.5 shadow-pop backdrop-blur-md'

  if (!phone) {
    return (
      <Panel position="bottom-center">
        <div role="toolbar" aria-label="Add to canvas" data-reveal="bottom" className={barClass}>
          {tools}
        </div>
      </Panel>
    )
  }

  return (
    // القائمة المفتوحة نافذة منبثقة مؤقتة تعلو شريط التكبير (لوحات React Flow كلها z-index 5 فتغطيها بحسب ترتيب الرسم)
    <Panel position="bottom-center" className={menuOpen ? 'z-20!' : undefined}>
      <div data-reveal="bottom" className="relative flex flex-col items-center">
        {menuOpen && (
          <div id="add-menu" role="toolbar" aria-label="Add to canvas" className={cn(barClass, 'absolute bottom-full mb-3')}>
            {tools}
          </div>
        )}
        <button
          type="button"
          aria-label={menuOpen ? 'Close add menu' : 'Open add menu'}
          aria-expanded={menuOpen}
          aria-controls="add-menu"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'grid size-14 place-items-center rounded-full border border-line bg-primary text-primary-ink shadow-pop transition-transform active:scale-95',
            activeTool !== 'select' && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
          )}
        >
          <Plus className={cn('size-6 transition-transform', menuOpen && 'rotate-45')} aria-hidden="true" />
        </button>
      </div>
    </Panel>
  )
}
