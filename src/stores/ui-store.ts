import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createId } from '@/lib/id'
import type { WorkspaceSortKey } from '@/features/workspaces/types/workspace'

import { isThemeMode, resolveTheme, systemPrefersDark, type Theme, type ThemeMode } from '@/lib/theme'

export type { Theme, ThemeMode }
export type ToastKind = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastOptions {
  /** معرّف ثابت: رسالة جديدة بنفس المعرّف تحلّ محل القديمة، ويمكن إغلاقها بالبرنامج (مثل «غير متصل») */
  id?: string
  /** لا تختفي وحدها (إصدار جديد جاهز، عدم اتصال)؛ تُغلق بالزر أو بالبرنامج */
  sticky?: boolean
  action?: ToastAction
}

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  sticky?: boolean
  action?: ToastAction
}

interface UiState {
  /** السمة المرسومة الآن (تُشتق من themeMode وتفضيل النظام) */
  theme: Theme
  /** تفضيل المستخدم: داكن أو فاتح أو تلقائي (يتبع النظام) */
  themeMode: ThemeMode
  /** تباين عالٍ: حدود وخطوط أوضح للقراءة، فوق السمة الحالية */
  highContrast: boolean
  /** قائمة التحقق الأولى على اللوحة: أُغلقت يدوياً؟ (تفضيل عام لكل المساحات) */
  checklistDismissed: boolean
  workspaceSort: WorkspaceSortKey
  /** مؤثر الخلفية الزخرفي (Three.js) في لوحة التحكم؛ اختياري ويمكن إيقافه */
  backgroundEffect: boolean
  /** محاذاة تحريك البطاقات إلى شبكة نقاط الخلفية (تفضيل عام لكل المساحات) */
  snapToGrid: boolean
  /** تصغير الصور الكبيرة وإعادة ترميزها WebP عند إضافتها (يوفر التخزين وحجم التصدير)؛ يمكن إيقافه للاحتفاظ بالأصل */
  compressImages: boolean
  toasts: Toast[]
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void
  /** يعكس تغيّر تفضيل النظام على السمة المرسومة؛ لا أثر له إلا في الوضع التلقائي */
  syncSystemTheme: (systemDark: boolean) => void
  setHighContrast: (enabled: boolean) => void
  dismissChecklist: () => void
  setWorkspaceSort: (sort: WorkspaceSortKey) => void
  setBackgroundEffect: (enabled: boolean) => void
  setSnapToGrid: (enabled: boolean) => void
  setCompressImages: (enabled: boolean) => void
  pushToast: (kind: ToastKind, message: string, options?: ToastOptions) => void
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
      themeMode: 'dark',
      highContrast: false,
      checklistDismissed: false,
      workspaceSort: 'modified',
      backgroundEffect: true,
      snapToGrid: false,
      compressImages: true,
      toasts: [],
      // اختيار سمة صريحة يلغي الوضع التلقائي
      setTheme: (theme) => set({ theme, themeMode: theme }),
      toggleTheme: () =>
        set((state) => {
          const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
          return { theme: next, themeMode: next }
        }),
      setThemeMode: (themeMode) => set({ themeMode, theme: resolveTheme(themeMode, systemPrefersDark()) }),
      syncSystemTheme: (systemDark) =>
        set((state) => (state.themeMode === 'system' ? { theme: resolveTheme('system', systemDark) } : state)),
      setHighContrast: (highContrast) => set({ highContrast }),
      dismissChecklist: () => set({ checklistDismissed: true }),
      setWorkspaceSort: (workspaceSort) => set({ workspaceSort }),
      setBackgroundEffect: (backgroundEffect) => set({ backgroundEffect }),
      setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
      setCompressImages: (compressImages) => set({ compressImages }),
      pushToast: (kind, message, options) =>
        set((state) => {
          const id = options?.id ?? createId()
          // رسالة بمعرّف ثابت تحلّ محل نسختها السابقة بدل أن تتكرر
          const others = options?.id ? state.toasts.filter((toast) => toast.id !== id) : state.toasts
          // نمنع تكدّس نفس الرسالة (مثلاً تكرار فشل الحفظ)
          if (!options?.id && others.some((toast) => toast.message === message)) return state
          const toast: Toast = {
            id,
            kind,
            message,
            ...(options?.sticky ? { sticky: true } : {}),
            ...(options?.action ? { action: options.action } : {}),
          }
          return { toasts: [...others, toast].slice(-MAX_TOASTS) }
        }),
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'infinitespace:v1:ui',
      version: 0,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        themeMode: state.themeMode,
        highContrast: state.highContrast,
        checklistDismissed: state.checklistDismissed,
        workspaceSort: state.workspaceSort,
        backgroundEffect: state.backgroundEffect,
        snapToGrid: state.snapToGrid,
        compressImages: state.compressImages,
      }),
      // قيم localStorage غير موثوقة: نقبل فقط القيم المعروفة ونرجع للافتراضي غير ذلك
      merge: (persisted, current) => {
        const saved = typeof persisted === 'object' && persisted !== null ? persisted : {}
        const theme = 'theme' in saved ? saved.theme : undefined
        const savedMode = 'themeMode' in saved ? saved.themeMode : undefined
        const contrast = 'highContrast' in saved ? saved.highContrast : undefined
        const dismissed = 'checklistDismissed' in saved ? saved.checklistDismissed : undefined
        const sort = 'workspaceSort' in saved ? saved.workspaceSort : undefined
        const effect = 'backgroundEffect' in saved ? saved.backgroundEffect : undefined
        const snap = 'snapToGrid' in saved ? saved.snapToGrid : undefined
        const compress = 'compressImages' in saved ? saved.compressImages : undefined
        const themeMode: ThemeMode = isThemeMode(savedMode) ? savedMode : theme === 'light' || theme === 'dark' ? theme : current.themeMode
        return {
          ...current,
          // الإصدارات السابقة حفظت theme فقط: نعتبره تفضيلاً صريحاً. القيم المجهولة ترجع للافتراضي
          themeMode,
          theme: resolveTheme(themeMode, systemPrefersDark()),
          highContrast: typeof contrast === 'boolean' ? contrast : current.highContrast,
          checklistDismissed: typeof dismissed === 'boolean' ? dismissed : current.checklistDismissed,
          workspaceSort:
            typeof sort === 'string' && SORT_KEYS.includes(sort as WorkspaceSortKey)
              ? (sort as WorkspaceSortKey)
              : current.workspaceSort,
          backgroundEffect: typeof effect === 'boolean' ? effect : current.backgroundEffect,
          snapToGrid: typeof snap === 'boolean' ? snap : current.snapToGrid,
          compressImages: typeof compress === 'boolean' ? compress : current.compressImages,
        }
      },
    },
  ),
)
