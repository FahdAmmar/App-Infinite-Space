import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createId } from '@/lib/id'
import type { WorkspaceSortKey } from '@/features/workspaces/types/workspace'

export type Theme = 'dark' | 'light'
export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface UiState {
  theme: Theme
  workspaceSort: WorkspaceSortKey
  /** مؤثر الخلفية الزخرفي (Three.js) في لوحة التحكم؛ اختياري ويمكن إيقافه */
  backgroundEffect: boolean
  toasts: Toast[]
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setWorkspaceSort: (sort: WorkspaceSortKey) => void
  setBackgroundEffect: (enabled: boolean) => void
  pushToast: (kind: ToastKind, message: string) => void
  dismissToast: (id: string) => void
}

const MAX_TOASTS = 4
const SORT_KEYS: readonly WorkspaceSortKey[] = ['modified', 'created', 'name']

/**
 * حالة الواجهة العامة. نستخدم persist هنا لأن التفضيلات صغيرة وغير حرجة.
 * أما بيانات المساحات فتُحفظ عبر طبقة التخزين الصريحة (services/persistence).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      workspaceSort: 'modified',
      backgroundEffect: true,
      toasts: [],
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setWorkspaceSort: (workspaceSort) => set({ workspaceSort }),
      setBackgroundEffect: (backgroundEffect) => set({ backgroundEffect }),
      pushToast: (kind, message) =>
        set((state) => {
          // نمنع تكدّس نفس الرسالة (مثلاً تكرار فشل الحفظ)
          if (state.toasts.some((toast) => toast.message === message)) return state
          const toasts = [...state.toasts, { id: createId(), kind, message }]
          return { toasts: toasts.slice(-MAX_TOASTS) }
        }),
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'infinitespace:v1:ui',
      version: 0,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        workspaceSort: state.workspaceSort,
        backgroundEffect: state.backgroundEffect,
      }),
      // قيم localStorage غير موثوقة: نقبل فقط القيم المعروفة ونرجع للافتراضي غير ذلك
      merge: (persisted, current) => {
        const saved = typeof persisted === 'object' && persisted !== null ? persisted : {}
        const theme = 'theme' in saved ? saved.theme : undefined
        const sort = 'workspaceSort' in saved ? saved.workspaceSort : undefined
        const effect = 'backgroundEffect' in saved ? saved.backgroundEffect : undefined
        return {
          ...current,
          theme: theme === 'light' || theme === 'dark' ? theme : current.theme,
          workspaceSort:
            typeof sort === 'string' && SORT_KEYS.includes(sort as WorkspaceSortKey)
              ? (sort as WorkspaceSortKey)
              : current.workspaceSort,
          backgroundEffect: typeof effect === 'boolean' ? effect : current.backgroundEffect,
        }
      },
    },
  ),
)
