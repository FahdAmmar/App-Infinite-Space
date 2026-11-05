import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FileText, Image as ImageIcon, Layers, Link as LinkIcon, Search, StickyNote, Type, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import type { CanvasNode } from '../types/nodes'
import { findMatches } from '../utils/find'
import { buildOutline } from '../utils/outline'

const EMPTY_NODES: readonly CanvasNode[] = []

const KIND_ICON = { sticky: StickyNote, text: Type, image: ImageIcon, link: LinkIcon, group: Layers } as const

/**
 * «المخطط»: قائمة خطية بكل مجموعات اللوحة وبطاقاتها بترتيب القراءة، والنقر على صف ينقلك إليه.
 * ثلاث فوائد: التنقل في لوحة كبيرة، وبديل مكاني مناسب للهاتف، وعرض مقروء لقارئ الشاشة (اللوحة نفسها مكانية).
 * لا تُحسب القائمة إلا والمخطط مفتوح، فلا تكلّف شيئاً وهو مغلق.
 */
export function OutlinePanel({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const open = useCanvasStore((state) => state.outlineOpen)
  const nodes = useCanvasStore((state) => (state.outlineOpen ? state.nodes : EMPTY_NODES))
  if (!open) return null
  return <OutlineBody nodes={nodes} commands={commands} onClose={() => api.getState().setOutlineOpen(false)} />
}

function OutlineBody({ nodes, commands, onClose }: { nodes: readonly CanvasNode[]; commands: CanvasCommands; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const entries = useMemo(() => buildOutline(nodes), [nodes])
  const selected = useMemo(() => new Set(nodes.filter((node) => node.selected).map((node) => node.id)), [nodes])
  const shown = useMemo(() => {
    if (query.trim() === '') return entries
    const matches = new Set(findMatches(nodes, query))
    return entries.filter((entry) => matches.has(entry.id))
  }, [entries, nodes, query])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <aside
      aria-label="Canvas outline"
      onKeyDown={handleKeyDown}
      className="absolute top-[4.5rem] bottom-28 left-3 z-20 flex w-72 flex-col rounded-2xl border border-line bg-surface/95 shadow-pop backdrop-blur-md max-sm:right-3 max-sm:w-auto sm:left-[4.5rem]"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <h2 className="text-sm font-semibold">
          Outline <span className="ml-1 font-mono text-xs font-normal text-muted">{entries.length}</span>
        </h2>
        <IconButton label="Close outline (Esc)" onClick={onClose} className="size-8">
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-line bg-bg px-2.5 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Filter the outline"
          placeholder="Filter…"
          dir="auto"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      {shown.length === 0 ? (
        <p role="status" className="px-4 py-6 text-center text-sm text-muted">
          {entries.length === 0 ? 'The canvas is empty.' : 'Nothing matches.'}
        </p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {shown.map((entry) => {
            const Icon = KIND_ICON[entry.kind] ?? FileText
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => commands.focusNode(entry.id)}
                  aria-current={selected.has(entry.id) ? 'true' : undefined}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    entry.depth === 1 && query.trim() === '' && 'pl-7',
                    selected.has(entry.id) && 'bg-raised font-medium',
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span dir="auto" className="min-w-0 flex-1 truncate">
                    {entry.label}
                  </span>
                  {entry.kind === 'group' && <span className="shrink-0 font-mono text-xs text-muted">{entry.childCount}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
