import { useEffect, useState } from 'react'
import type { Viewport } from '@xyflow/react'
import { storage } from '@/services/persistence'
import { toStorageError } from '@/services/persistence/local-storage-adapter'
import type { StorageFailureReason } from '@/services/persistence/storage-adapter'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { deserializeCanvas } from './canvas-codec'

export type LoadedCanvasState =
  | { status: 'loading' }
  | {
      status: 'ready'
      nodes: CanvasNode[]
      edges: CanvasEdge[]
      viewport: Viewport
      /** عدد العناصر التالفة التي تعذّر استرجاعها */
      discardedCount: number
      /** وُجد محتوى محفوظ لكن تعذّر فهمه كله (وحُفظت منه نسخة احتياطية إن أمكن) */
      unreadable: boolean
      backedUp: boolean
    }
  | { status: 'error'; reason: StorageFailureReason }

const EMPTY_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

/**
 * يقرأ لوحة المساحة من التخزين مرة لكل (مساحة، محاولة) ويتحقق منها قبل تسليمها للمحرر.
 * عند فشل القراءة (تخزين محجوب مثلاً) نعيد خطأ ولا نفتح لوحة فارغة: فتح فارغة ثم الحفظ التلقائي
 * سيكتبان فوق لوحة المستخدم الحقيقية التي لم نستطع قراءتها.
 */
export function useLoadedCanvas(workspaceId: string, attempt: number): LoadedCanvasState {
  const key = `${workspaceId}:${attempt}`
  const [result, setResult] = useState<{ key: string; value: LoadedCanvasState } | null>(null)

  useEffect(() => {
    let cancelled = false
    storage
      .loadCanvas(workspaceId)
      .then((loaded): LoadedCanvasState => {
        if (!loaded.canvas) {
          return {
            status: 'ready',
            nodes: [],
            edges: [],
            viewport: EMPTY_VIEWPORT,
            discardedCount: 0,
            unreadable: loaded.unreadable,
            backedUp: loaded.backupKey !== null,
          }
        }
        const decoded = deserializeCanvas(loaded.canvas)
        return {
          status: 'ready',
          nodes: decoded.nodes,
          edges: decoded.edges,
          viewport: decoded.viewport,
          discardedCount: decoded.discardedCount,
          unreadable: false,
          backedUp: false,
        }
      })
      .catch((error: unknown): LoadedCanvasState => ({ status: 'error', reason: toStorageError(error).reason }))
      .then((value) => {
        if (!cancelled) setResult({ key, value })
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, key])

  return result?.key === key ? result.value : { status: 'loading' }
}
