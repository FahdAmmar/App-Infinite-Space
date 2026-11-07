import type { KeyboardEvent, RefObject } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'

interface FindBarViewProps {
  query: string
  /** موضع المطابقة الحالية (يبدأ من 1)، أو 0 إن لم توجد */
  position: number
  total: number
  inputRef: RefObject<HTMLInputElement | null>
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

/** عرض شريط البحث (بلا منطق): Enter التالي، Shift+Enter السابق، Esc إغلاق. */
export function FindBarView({ query, position, total, inputRef, onQueryChange, onNext, onPrevious, onClose }: FindBarViewProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) onPrevious()
      else onNext()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const status = query.trim() === '' ? '' : total === 0 ? 'No matches' : `${position} of ${total}`

  return (
    <div
      role="search"
      className="absolute inset-x-3 top-[calc(4.5rem+var(--safe-top))] z-20 mx-auto flex w-fit max-w-[92vw] items-center gap-1 rounded-2xl border border-line bg-raised p-1.5 shadow-pop"
    >
      <Search className="ms-2 size-4 shrink-0 text-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Find on canvas"
        placeholder="Find cards, or #tag"
        dir="auto"
        autoComplete="off"
        spellCheck={false}
        className="h-9 w-44 min-w-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted sm:w-64"
      />
      <span role="status" aria-live="polite" className="min-w-[4.5rem] text-center text-xs text-muted tabular-nums">
        {status}
      </span>
      <IconButton label="Previous match (Shift+Enter)" onClick={onPrevious} disabled={total === 0} className="size-9">
        <ChevronUp className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton label="Next match (Enter)" onClick={onNext} disabled={total === 0} className="size-9">
        <ChevronDown className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton label="Close find (Esc)" onClick={onClose} className="size-9">
        <X className="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  )
}
