import { create } from 'zustand'
import { isStoragePersistent, storage } from '@/services/persistence'
import { StorageError, type StorageAdapter } from '@/services/persistence/storage-adapter'
import type { WorkspaceInput, WorkspaceMeta } from '@/features/workspaces/types/workspace'
import {
  createWorkspaceMeta,
  duplicateWorkspaceMeta,
  makeCopyName,
} from '@/features/workspaces/utils/factory'
import { validateWorkspaceText } from '@/features/workspaces/utils/validation'
import type { CanvasSummary } from '@/features/canvas/persistence/workspace-summary'
import { useUiStore, type ToastKind } from './ui-store'

interface WorkspaceState {
  /** 'loading' حتى تنتهي القراءة الأولى، لئلا تومض شاشة "لا توجد مساحات" بالخطأ */
  status: 'loading' | 'ready'
  workspaces: WorkspaceMeta[]
  hydrate: () => Promise<void>
  createWorkspace: (input: WorkspaceInput) => WorkspaceMeta
  updateWorkspace: (id: string, patch: Partial<WorkspaceInput>) => void
  duplicateWorkspace: (id: string) => Promise<WorkspaceMeta | null>
  deleteWorkspace: (id: string) => Promise<void>
  markOpened: (id: string) => void
  /**
   * يُستدعى بعد حفظ اللوحة: يحدّث عدد العناصر والمعاينة (لبطاقة لوحة التحكم)، وإن تغيّر المحتوى (لا العرض فقط)
   * يحدّث «آخر تعديل». لا يفعل شيئاً إن لم تعد المساحة موجودة.
   */
  recordCanvasSummary: (id: string, summary: CanvasSummary, contentChanged: boolean) => void
  /** ينتظر انتهاء الحفظ الجاري (يُستخدم في الاختبارات وقبل العمليات المعتمدة على الحفظ). */
  flushSaves: () => Promise<void>
}

function describeSaveError(error: unknown): string {
  if (error instanceof StorageError && error.reason === 'quota') {
    return "Browser storage is full, so your latest changes aren't saved. Delete workspaces you no longer need to free room."
  }
  return "Your latest changes couldn't be saved. Browser storage may be blocked."
}

/** يتحقق من النص وينظّفه. المخزن يعيد التحقق كي لا يعتمد صحة بياناته على المستدعي. */
function cleanText(name: string, description: string): { name: string; description: string } {
  const check = validateWorkspaceText(name, description)
  if (!check.ok) throw new Error(check.errors.name ?? check.errors.description ?? 'Invalid input')
  return check.value
}

/**
 * مصنع المخزن: يستقبل المحوّل كمعامل ليمكن اختباره بمحوّل وهمي دون لمس localStorage الحقيقي.
 */
export function createWorkspaceStore(adapter: StorageAdapter, options: { persistent?: boolean } = {}) {
  const notify = (kind: ToastKind, message: string): void =>
    useUiStore.getState().pushToast(kind, message)

  // طابور الحفظ: كل عملية حفظ تقرأ الحالة "لحظة تنفيذها" لا لحظة طلبها،
  // وتُنفَّذ بالتسلسل، فلا يمكن لحفظ قديم أن يكتب فوق تغيير أحدث.
  let saveQueue: Promise<void> = Promise.resolve()
  let hydration: Promise<void> | null = null

  return create<WorkspaceState>()((set, get) => {
    const persist = (): Promise<boolean> => {
      const run = saveQueue.then(async () => {
        try {
          await adapter.saveWorkspaces(get().workspaces)
          return true
        } catch (error) {
          notify('error', describeSaveError(error))
          return false
        }
      })
      saveQueue = run.then(() => undefined)
      return run
    }

    // إعادة قراءة صامتة عند تعديل تبويب آخر للبيانات (آخر كاتب يفوز، مع تجنب الكتابة من حالة قديمة)
    const reloadFromStorage = async (): Promise<void> => {
      try {
        const loaded = await adapter.loadWorkspaces()
        if (!loaded.unreadable) set({ workspaces: loaded.workspaces })
      } catch {
        /* نبقي الحالة الحالية؛ لا فائدة من إزعاج المستخدم بخطأ مؤقت */
      }
    }

    return {
      status: 'loading',
      workspaces: [],

      hydrate: () => {
        hydration ??= (async () => {
          try {
            const loaded = await adapter.loadWorkspaces()
            set({ workspaces: loaded.workspaces, status: 'ready' })
            if (loaded.unreadable) {
              notify(
                'error',
                loaded.backupKey
                  ? "Your saved workspaces couldn't be read. A backup copy was kept in this browser."
                  : "Your saved workspaces couldn't be read.",
              )
            } else if (loaded.discardedCount > 0) {
              notify('info', `${loaded.discardedCount} damaged saved item(s) were skipped.`)
            }
          } catch {
            set({ workspaces: [], status: 'ready' })
            notify('error', "Your workspaces couldn't be loaded because browser storage is unavailable.")
          }
          if (options.persistent === false) {
            notify('info', "Browser storage is unavailable, so workspaces won't be kept after you close this tab.")
          }
          adapter.subscribeToExternalChanges(() => void reloadFromStorage())
        })()
        return hydration
      },

      createWorkspace: (input) => {
        const text = cleanText(input.name, input.description)
        const workspace = createWorkspaceMeta({ ...input, ...text }, Date.now())
        set((state) => ({ workspaces: [workspace, ...state.workspaces] }))
        void persist()
        return workspace
      },

      updateWorkspace: (id, patch) => {
        const current = get().workspaces.find((workspace) => workspace.id === id)
        if (!current) return

        const text = cleanText(patch.name ?? current.name, patch.description ?? current.description)
        const next: WorkspaceMeta = {
          ...current,
          ...text,
          color: patch.color ?? current.color,
          icon: patch.icon ?? current.icon,
        }
        // لا نغيّر "آخر تعديل" إذا لم يتغير شيء فعلاً
        const unchanged =
          next.name === current.name &&
          next.description === current.description &&
          next.color === current.color &&
          next.icon === current.icon
        if (unchanged) return

        next.updatedAt = Date.now()
        set((state) => ({
          workspaces: state.workspaces.map((workspace) => (workspace.id === id ? next : workspace)),
        }))
        void persist()
      },

      duplicateWorkspace: async (id) => {
        const source = get().workspaces.find((workspace) => workspace.id === id)
        if (!source) return null

        const name = makeCopyName(
          source.name,
          get().workspaces.map((workspace) => workspace.name),
        )
        const copy = duplicateWorkspaceMeta(source, name, Date.now())

        // ننسخ بيانات اللوحة (العقد والروابط) أولاً؛ إن فشل النسخ لا نترك نسخة ناقصة
        try {
          await adapter.copyCanvas(source.id, copy.id)
        } catch (error) {
          notify('error', describeSaveError(error))
          return null
        }

        set((state) => ({ workspaces: [copy, ...state.workspaces] }))
        void persist()
        return copy
      },

      deleteWorkspace: async (id) => {
        if (!get().workspaces.some((workspace) => workspace.id === id)) return

        set((state) => ({ workspaces: state.workspaces.filter((workspace) => workspace.id !== id) }))
        // نحذف بيانات اللوحة فقط بعد نجاح حفظ القائمة الجديدة؛ وإلا قد تعود المساحة فارغة
        const saved = await persist()
        if (!saved) return
        try {
          await adapter.deleteCanvas(id)
        } catch {
          notify('error', "The workspace was deleted, but some of its data couldn't be cleared from browser storage.")
        }
      },

      markOpened: (id) => {
        const exists = get().workspaces.some((workspace) => workspace.id === id)
        if (!exists) return
        const now = Date.now()
        set((state) => ({
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === id ? { ...workspace, lastOpenedAt: now } : workspace,
          ),
        }))
        void persist()
      },

      recordCanvasSummary: (id, summary, contentChanged) => {
        const current = get().workspaces.find((workspace) => workspace.id === id)
        if (!current) return
        const next: WorkspaceMeta = {
          ...current,
          nodeCount: summary.nodeCount,
          preview: summary.preview,
          updatedAt: contentChanged ? Date.now() : current.updatedAt,
        }
        set((state) => ({ workspaces: state.workspaces.map((workspace) => (workspace.id === id ? next : workspace)) }))
        void persist()
      },

      flushSaves: () => saveQueue,
    }
  })
}

/** نسخة التطبيق الفعلية المربوطة بطبقة التخزين الحقيقية. */
export const useWorkspaceStore = createWorkspaceStore(storage, { persistent: isStoragePersistent })
