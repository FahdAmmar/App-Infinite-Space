import type { CanvasState } from './canvas-store'

/**
 * محددات (selectors) مشتقة. القاعدة: المحدد يعيد قيمة بدائية أو مرجعاً ثابتاً،
 * وإذا احتجنا مصفوفة نغلّفه بـ useShallow عند الاستخدام (وإلا تسبب حلقة إعادة رسم في Zustand 5).
 */
export const selectSelectedIds = (state: CanvasState): string[] =>
  state.nodes.filter((node) => node.selected).map((node) => node.id)

export const selectSelectedEdgeIds = (state: CanvasState): string[] =>
  state.edges.filter((edge) => edge.selected).map((edge) => edge.id)

export const selectSelectedCount = (state: CanvasState): number =>
  state.nodes.reduce((count, node) => (node.selected ? count + 1 : count), 0)

export const selectNodeCount = (state: CanvasState): number => state.nodes.length
