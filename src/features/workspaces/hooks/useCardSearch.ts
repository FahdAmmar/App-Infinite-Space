import { useEffect, useRef, useState } from 'react'
import { deserializeCanvas } from '@/features/canvas/persistence/canvas-codec'
import { storage } from '@/services/persistence'
import type { WorkspaceMeta } from '../types/workspace'
import { searchCards, type CardHit, type SearchableWorkspace } from '../utils/card-search'

const DEBOUNCE_MS = 250

/**
 * بحث في محتوى كل المساحات من لوحة التحكم. الفهرس يُبنى عند أول بحث فقط (قراءة لوحات المساحات من التخزين المحلي)،
 * ويُعاد تحميل مساحة فقط إذا تغيّر وقت تعديلها، فلا كلفة على من لا يبحث.
 * اللوحات التالفة أو غير المقروءة تُتخطى بصمت: هذا بحث مساعد، وإظهار الأخطاء مكانه فتح المساحة نفسها.
 */
export function useCardSearch(workspaces: readonly WorkspaceMeta[], query: string): { hits: CardHit[]; searching: boolean } {
  const cache = useRef(new Map<string, { updatedAt: number; entry: SearchableWorkspace }>())
  const [state, setState] = useState<{ query: string; hits: CardHit[] }>({ query: '', hits: [] })
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed === '') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const index: SearchableWorkspace[] = []
        // الأحدث تعديلاً أولاً: نتائجه أرجح أن تكون مقصودة
        for (const workspace of [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt)) {
          const cached = cache.current.get(workspace.id)
          if (cached && cached.updatedAt === workspace.updatedAt) {
            index.push(cached.entry)
            continue
          }
          try {
            const loaded = await storage.loadCanvas(workspace.id)
            if (cancelled) return
            if (loaded.unreadable || loaded.canvas === null) continue
            const entry = { id: workspace.id, name: workspace.name, nodes: deserializeCanvas(loaded.canvas).nodes }
            cache.current.set(workspace.id, { updatedAt: workspace.updatedAt, entry })
            index.push(entry)
          } catch {
            // مساحة لا تُقرأ الآن: نتخطاها
          }
        }
        if (!cancelled) setState({ query: trimmed, hits: searchCards(index, trimmed) })
      })()
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trimmed, workspaces])

  // النتائج القديمة لا تُعرض لاستعلام جديد: نخفيها حتى تصل نتائجه (وبدون استعلام لا شيء)
  const current = trimmed !== '' && state.query === trimmed
  return { hits: current ? state.hits : [], searching: trimmed !== '' && !current }
}
