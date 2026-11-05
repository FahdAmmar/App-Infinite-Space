import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { MAX_SNIPPETS, sanitizeSnippets, type Snippet } from '@/features/canvas/utils/snippets'

interface SnippetState {
  snippets: Snippet[]
  /** false إن بلغنا الحد الأقصى */
  addSnippet: (snippet: Snippet) => boolean
  removeSnippet: (id: string) => void
}

/** المقتطفات الشخصية: تفضيل صغير مشترك بين المساحات، فيُحفظ مع التفضيلات في localStorage (انظر snippets.ts للقيود). */
export const useSnippetStore = create<SnippetState>()(
  persist(
    (set, get) => ({
      snippets: [],
      addSnippet: (snippet) => {
        if (get().snippets.length >= MAX_SNIPPETS) return false
        set((state) => ({ snippets: [snippet, ...state.snippets] }))
        return true
      },
      removeSnippet: (id) => set((state) => ({ snippets: state.snippets.filter((snippet) => snippet.id !== id) })),
    }),
    {
      name: 'infinitespace:v1:snippets',
      version: 0,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ snippets: state.snippets }),
      // localStorage غير موثوق: كل مقتطف يمر بتنظيف اللوحة نفسه
      merge: (persisted, current) => ({
        ...current,
        snippets: sanitizeSnippets(isRecordLike(persisted) ? persisted.snippets : undefined, Date.now()),
      }),
    },
  ),
)

function isRecordLike(value: unknown): value is { snippets?: unknown } {
  return typeof value === 'object' && value !== null
}
