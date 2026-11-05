import { useLayoutEffect, useRef } from 'react'
import { NodeToolbar, Position, useStore } from '@xyflow/react'
import { BringToFront, Copy, SendToBack, Spline, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { selectSelectedIds } from '@/stores/canvas-selectors'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { STICKY_COLOR_IDS } from '../types/nodes'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import { STICKY_COLORS } from '../utils/constants'
import { computeToolbarShift, type Box } from '../utils/toolbar-position'
import { ArrangeButtons } from './ArrangeButtons'

// top: تحت شريط العنوان العائم (حوالي 4rem). offset يطابق offset الممرَّر إلى NodeToolbar أدناه
const TOOLBAR_SAFE_AREA = { gap: 8, top: 72, offset: 16 }

// عناصر الواجهة السفلية التي لا يجوز أن يغطيها الشريط إن انقلب أسفل التحديد (على الهاتف تتراص تحته)
const BOTTOM_OVERLAYS = ['aside[aria-label="Properties"]', '[role="toolbar"][aria-label="Zoom and view"]', '[role="toolbar"][aria-label="Add to canvas"]']

/** أعلى حافة لأقرب عنصر سفلي يبدأ تحت `y`، أو undefined إن لم يوجد. */
function firstOverlayTopBelow(y: number): number | undefined {
  const tops = BOTTOM_OVERLAYS.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => element.getBoundingClientRect().top)).filter(
    (top) => top >= y,
  )
  return tops.length > 0 ? Math.min(...tops) : undefined
}

/** حدود مجموعة عناصر على الشاشة، أو null إن لم يوجد أي منها (مثلاً كلها خارج المنطقة المرسومة). */
function selectionBounds(elements: NodeListOf<Element>): Box | null {
  let box: Box | null = null
  elements.forEach((element) => {
    const r = element.getBoundingClientRect()
    box = box
      ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  })
  return box
}

/**
 * شريط إجراءات عائم فوق العقدة المحددة (أو فوق مجموعة المحددات):
 * ألوان الورقة أو المجموعة (عند تحديد واحدة منهما)، وصل، تكرار، حذف.
 * يُخفى أثناء تحرير النص حتى لا يغطي ما يكتبه المستخدم، وأثناء أدوات الإنشاء والوصل.
 */
export function SelectionToolbar({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  // useShallow: المحدد يعيد مصفوفة جديدة كل مرة، وهذا يقارنها عنصراً بعنصر لمنع حلقة إعادة الرسم
  const ids = useCanvasStore(useShallow(selectSelectedIds))
  const isEditing = useCanvasStore((state) => state.editingNodeId !== null)
  // أثناء وضع أداة إنشاء أو وصل تكون النقرة التالية على اللوحة، والشريط (خصوصاً إن انقلب أسفل التحديد) سيغطي موضعها
  const placing = useCanvasStore((state) => state.tool !== 'select' && state.tool !== 'hand')
  const single = useCanvasStore((state) => (ids.length === 1 ? state.nodes.find((node) => node.id === ids[0]) : undefined))

  // الشريط يتمركز فوق البطاقة فيخرج من شاشة الهاتف قرب الحواف أو يختفي تحت شريط العنوان؛ بعد كل رسم (وعند التحريك
  // والتكبير) نقيسه من موضعه الأصلي (translate صفر) ثم نزيحه. نكتب على الخاصية translate لا transform كي لا نصطدم بموضع NodeToolbar.
  const barRef = useRef<HTMLDivElement>(null)
  useStore((state) => state.transform)
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    bar.style.translate = '0px 0px'
    const rect = bar.getBoundingClientRect()
    const selection = selectionBounds(document.querySelectorAll('.react-flow__node.selected'))
    const bottom = selection ? firstOverlayTopBelow(selection.bottom) : undefined
    const safe = bottom === undefined ? TOOLBAR_SAFE_AREA : { ...TOOLBAR_SAFE_AREA, bottom }
    const shift = computeToolbarShift(rect, selection, { width: window.innerWidth, height: window.innerHeight }, safe)
    bar.style.translate = shift.x === 0 && shift.y === 0 ? '' : `${shift.x}px ${shift.y}px`
  })

  if (ids.length === 0 || isEditing || placing) return null

  const colorable = single?.type === 'sticky' || single?.type === 'group' ? single : undefined
  const activeColor = colorable ? colorable.data.color : null
  const plural = ids.length > 1

  return (
    <NodeToolbar nodeId={ids} isVisible position={Position.Top} offset={TOOLBAR_SAFE_AREA.offset}>
      <div
        ref={barRef}
        role="toolbar"
        aria-label={plural ? `Actions for ${ids.length} selected items` : 'Actions for the selected item'}
        className="nodrag nopan flex max-w-[92vw] flex-wrap items-center justify-center gap-1 rounded-2xl border border-line bg-raised p-1.5 shadow-pop"
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
        {plural && <ArrangeButtons />}
        {single && single.type !== 'group' && (
          <IconButton label="Connect to another item (C)" onClick={() => commands.startConnectFrom(single.id)} className="size-9">
            <Spline className="size-4" aria-hidden="true" />
          </IconButton>
        )}
        <IconButton label="Bring to front (])" onClick={() => api.getState().reorderLayers(ids, 'front')} className="size-9">
          <BringToFront className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label="Send to back ([)" onClick={() => api.getState().reorderLayers(ids, 'back')} className="size-9">
          <SendToBack className="size-4" aria-hidden="true" />
        </IconButton>
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
