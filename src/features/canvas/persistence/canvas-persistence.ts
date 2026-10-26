import type { Viewport } from '@xyflow/react'
import { toStorageError } from '@/services/persistence/local-storage-adapter'
import type { StorageAdapter } from '@/services/persistence/storage-adapter'
import type { CanvasState, CanvasStoreApi } from '@/stores/canvas-store'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { canvasContentEqual } from '../utils/canvas-equality'
import { serializeCanvas } from './canvas-codec'
import { summarizeCanvas, type CanvasSummary } from './workspace-summary'

/** مهلة الهدوء قبل الحفظ: تجمع سلسلة تعديلات متقاربة في كتابة واحدة. */
export const SAVE_DEBOUNCE_MS = 800
/** أقصى انتظار منذ أول تعديل غير محفوظ، كي لا يؤجَّل الحفظ للأبد أثناء عمل متواصل. */
export const SAVE_MAX_WAIT_MS = 5000

interface Persisted {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
}

export interface CanvasPersistenceOptions {
  workspaceId: string
  store: CanvasStoreApi
  storage: Pick<StorageAdapter, 'saveCanvas'>
  /** بعد كل حفظ ناجح: ملخص اللوحة، وهل تغيّر المحتوى (لا مجرد العرض) منذ آخر حفظ */
  onSaved?: (summary: CanvasSummary, contentChanged: boolean) => void
  debounceMs?: number
  maxWaitMs?: number
  now?: () => number
}

export interface CanvasPersistence {
  /** يحفظ فوراً ما لم يُحفظ بعد (يُستدعى عند مغادرة المحرر أو إخفاء الصفحة). */
  flush: () => Promise<void>
  /** إعادة محاولة بعد فشل. */
  retry: () => Promise<void>
  /** يوقف المراقبة والمؤقتات. لا يلغي حفظاً جارياً. */
  dispose: () => void
  /** هل هناك تعديلات غير محفوظة (أو فشل حفظ)؟ */
  hasUnsavedChanges: () => boolean
}

const viewportEqual = (a: Viewport, b: Viewport): boolean => a.x === b.x && a.y === b.y && a.zoom === b.zoom

/**
 * الحفظ التلقائي للوحة (مواصفات 9).
 *
 * المبادئ:
 *  1. ما يُحفظ هو «المحتوى» (العقد والوصلات والعرض) لا الحالة اللحظية: التحديد والسحب والقياس لا تُشغّل حفظاً
 *     (مقارنة canvasContentEqual مع آخر حالة محفوظة).
 *  2. حفظ مؤجَّل (debounce) بسقف انتظار أقصى، فلا كتابة لكل حركة مؤشر ولا تأجيل بلا نهاية.
 *  3. عدم الكتابة من حالة قديمة: كل حفظ يقرأ حالة المخزن «لحظة تنفيذه» لا لحظة طلبه، والحفظات تُنفَّذ
 *     بالتسلسل. فلا يمكن لحفظ بطيء قديم أن يتخطى حفظاً أحدث.
 *  4. فشل الحفظ لا يضيّع العمل: يبقى في الذاكرة، تظهر حالة الخطأ، ويُعاد المحاولة عند التعديل التالي أو بزر إعادة المحاولة.
 *  5. العودة (تراجع) إلى الحالة المحفوظة نفسها تُنهي حالة «غير محفوظ» دون كتابة.
 */
export function createCanvasPersistence(options: CanvasPersistenceOptions): CanvasPersistence {
  const { workspaceId, store, storage, onSaved } = options
  const debounceMs = options.debounceMs ?? SAVE_DEBOUNCE_MS
  const maxWaitMs = options.maxWaitMs ?? SAVE_MAX_WAIT_MS
  const now = options.now ?? Date.now

  const read = (state: CanvasState): Persisted => ({ nodes: state.nodes, edges: state.edges, viewport: state.viewport })
  let saved: Persisted = read(store.getState())
  let queue: Promise<void> = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstDirtyAt: number | null = null
  let disposed = false

  const isDirty = (): boolean => {
    const current = read(store.getState())
    return !canvasContentEqual(current, saved) || !viewportEqual(current.viewport, saved.viewport)
  }

  const setStatus = (status: CanvasState['saveStatus']): void => {
    const current = store.getState().saveStatus
    const same =
      current.kind === status.kind &&
      (status.kind !== 'error' || (current.kind === 'error' && current.reason === status.reason)) &&
      (status.kind !== 'saved' || (current.kind === 'saved' && current.at === status.at))
    if (!same) store.getState().setSaveStatus(status)
  }

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const run = async (): Promise<void> => {
    clearTimer()
    firstDirtyAt = null
    const status = store.getState().saveStatus
    if (!isDirty()) {
      // لا جديد منذ آخر حفظ (أو رجع المستخدم بالتراجع إلى الحالة المحفوظة حتى لو كان آخر حفظ فاشلاً): لا ضياع
      setStatus({ kind: 'saved', at: status.kind === 'saved' ? status.at : now() })
      return
    }

    const snapshot = read(store.getState())
    setStatus({ kind: 'saving' })
    try {
      await storage.saveCanvas(workspaceId, serializeCanvas(snapshot.nodes, snapshot.edges, snapshot.viewport))
    } catch (error) {
      setStatus({ kind: 'error', reason: toStorageError(error).reason })
      return
    }

    const contentChanged = !canvasContentEqual(snapshot, saved)
    saved = snapshot
    onSaved?.(summarizeCanvas(snapshot.nodes), contentChanged)

    if (isDirty()) {
      // تغيّر شيء أثناء الكتابة: نبقى «غير محفوظ» ونجدول حفظاً آخر (لن نكتب فوق الأحدث: القراءة لحظة التنفيذ)
      setStatus({ kind: 'unsaved' })
      if (!disposed) schedule()
    } else {
      setStatus({ kind: 'saved', at: now() })
    }
  }

  const enqueue = (): Promise<void> => {
    queue = queue.then(run, run)
    return queue
  }

  function schedule(): void {
    if (disposed) return
    const t = now()
    firstDirtyAt ??= t
    clearTimer()
    const wait = Math.max(0, Math.min(debounceMs, firstDirtyAt + maxWaitMs - t))
    timer = setTimeout(() => void enqueue(), wait)
  }

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.nodes === previous.nodes && state.edges === previous.edges && state.viewport === previous.viewport) return
    if (isDirty()) {
      if (state.saveStatus.kind !== 'error' && state.saveStatus.kind !== 'saving') setStatus({ kind: 'unsaved' })
      schedule()
    } else if (state.saveStatus.kind === 'unsaved') {
      // رجعنا إلى الحالة المحفوظة (تراجع): لا حاجة لكتابة
      clearTimer()
      firstDirtyAt = null
      setStatus({ kind: 'saved', at: now() })
    }
  })

  return {
    flush: () => enqueue(),
    retry: () => enqueue(),
    dispose: () => {
      disposed = true
      clearTimer()
      unsubscribe()
    },
    hasUnsavedChanges: () => isDirty() || store.getState().saveStatus.kind === 'error',
  }
}
