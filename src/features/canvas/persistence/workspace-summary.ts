import type { PreviewRect } from '@/features/workspaces/types/workspace'
import { PREVIEW_AREA, PREVIEW_MAX_RECTS } from '@/features/workspaces/utils/constants'
import type { CanvasNode } from '../types/nodes'
import { getAbsolutePosition, getNodeSize } from '../utils/group-utils'

export interface CanvasSummary {
  nodeCount: number
  preview: PreviewRect[]
}

/** ارتفاع تقريبي لبطاقة صورة لم يقسها React Flow بعد (ترويسة + هوامش + نسبة الصورة). */
function estimatedSize(node: CanvasNode): { width: number; height: number } {
  if (node.type === 'image') {
    const width = node.width ?? 280
    return { width, height: (width * node.data.naturalHeight) / node.data.naturalWidth + 56 }
  }
  return getNodeSize(node)
}

/**
 * ملخص اللوحة لبطاقة لوحة التحكم: عدد العناصر ومستطيلات مطبّعة تمثّل أماكنها.
 * نحافظ على التناسب (مقياس واحد للمحورين) ونوسّط المحتوى في مساحة المعاينة، فتبدو المعاينة مصغّراً أميناً للوحة.
 * إن زادت العقد عن الحد نبقي المجموعات ثم الأكبر مساحة، فتبقى الصورة العامة مفهومة.
 */
export function summarizeCanvas(nodes: readonly CanvasNode[]): CanvasSummary {
  if (nodes.length === 0) return { nodeCount: 0, preview: [] }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const boxes = nodes.map((node) => {
    const { x, y } = getAbsolutePosition(node, byId)
    const { width, height } = estimatedSize(node)
    return { kind: node.type, x, y, width, height, area: width * height }
  })

  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))
  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)

  const scale = Math.min(PREVIEW_AREA.width / contentW, PREVIEW_AREA.height / contentH)
  const offsetX = (PREVIEW_AREA.width - contentW * scale) / 2
  const offsetY = (PREVIEW_AREA.height - contentH * scale) / 2

  const kept = boxes.length <= PREVIEW_MAX_RECTS
    ? boxes
    : [...boxes]
        .sort((a, b) => Number(b.kind === 'group') - Number(a.kind === 'group') || b.area - a.area)
        .slice(0, PREVIEW_MAX_RECTS)

  const unit = (value: number, total: number): number => Math.min(1, Math.max(0, value / total))
  const preview: PreviewRect[] = kept
    // المجموعات أولاً كي تُرسم خلف العناصر (نفس ترتيب اللوحة)
    .sort((a, b) => Number(b.kind === 'group') - Number(a.kind === 'group'))
    .map((b) => ({
      kind: b.kind,
      x: unit(offsetX + (b.x - minX) * scale, PREVIEW_AREA.width),
      y: unit(offsetY + (b.y - minY) * scale, PREVIEW_AREA.height),
      w: unit(b.width * scale, PREVIEW_AREA.width),
      h: unit(b.height * scale, PREVIEW_AREA.height),
    }))
  return { nodeCount: nodes.length, preview }
}
