import { useState, type ReactNode } from 'react'
import type { Viewport } from '@xyflow/react'
import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { createCanvasStore } from './canvas-store'
import { CanvasStoreContext } from './canvas-store-context'

/** فوق هذا العدد من العناصر تبدأ الخريطة المصغّرة مخفية */
const LARGE_CANVAS_NODES = 1500

export interface InitialCanvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
}

/**
 * ينشئ مخزن لوحة جديداً لكل محرر، يبدأ من المحتوى المحمَّل من التخزين (بعد التحقق منه).
 * استخدم key={workspaceId} لإعادة البدء عند تغيّر المساحة. لا يُعاد إنشاء المخزن عند تغيّر initial لاحقاً:
 * القيمة الابتدائية تُقرأ مرة واحدة.
 */
export function CanvasStoreProvider({ children, initial }: { children: ReactNode; initial?: InitialCanvas }) {
  // الخريطة المصغّرة تبدأ مخفية على الجوال (تغطي مساحة ثمينة)، ولوحة الخصائص تبدأ مطويّة تحت 1024px
  // (على الجهاز اللوحي العمودي تأخذ ثلث العرض) ويفتحها المستخدم عند الحاجة.
  const [store] = useState(() => {
    const medium = window.matchMedia('(min-width: 768px)').matches
    const wide = window.matchMedia('(min-width: 1024px)').matches
    return createCanvasStore({
      ...(initial ? { initialNodes: initial.nodes, initialEdges: initial.edges, initialViewport: initial.viewport } : {}),
      // الخريطة المصغّرة ترسم مستطيلاً SVG لكل عنصر في اللوحة؛ فوق ~1500 عنصر تضاعف كلفة كل إطار تحريك،
      // فتبدأ مخفية في اللوحات الكبيرة (يظهرها المستخدم بزر الخريطة).
      minimapVisible: medium && (initial?.nodes.length ?? 0) <= LARGE_CANVAS_NODES,
      panelCollapsed: !wide,
    })
  })
  return <CanvasStoreContext value={store}>{children}</CanvasStoreContext>
}
