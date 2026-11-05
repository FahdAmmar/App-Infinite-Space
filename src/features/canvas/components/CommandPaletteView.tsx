import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { filterCommands } from '../utils/command-search'

export interface PaletteItem {
  id: string
  title: string
  /** يظهر يمين الصف إن لم يكن هناك اختصار */
  group: string
  /** اختصار لوحة المفاتيح لنفس الأمر، للتذكير فقط */
  hint?: string
  keywords?: readonly string[]
  run: () => void
}

/** أقصى عدد صفوف مرسومة: قوائم المساحات الطويلة لا تثقل الرسم، والمستخدم يضيّق بالكتابة. */
const MAX_ROWS = 50

function PaletteBody({ items, onRun }: { items: readonly PaletteItem[]; onRun: (item: PaletteItem) => void }) {
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => filterCommands(items, query).slice(0, MAX_ROWS), [items, query])
  const current = results.length === 0 ? -1 : Math.min(active, results.length - 1)
  const optionId = (index: number) => `${listId}-${index}`

  useEffect(() => {
    // jsdom لا يوفر scrollIntoView؛ في المتصفح يُبقي الصف النشط ظاهراً أثناء التنقل بالأسهم
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [current])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = results[current]
      if (item) onRun(item)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          data-autofocus
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or a workspace name"
          dir="auto"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Commands" className="mt-3 max-h-[min(50dvh,22rem)] space-y-0.5 overflow-y-auto">
        {results.map((item, index) => (
          <li
            key={item.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === current}
            onMouseMove={() => setActive(index)}
            onClick={() => onRun(item)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm',
              index === current ? 'bg-surface text-ink' : 'text-muted',
            )}
          >
            <span className="min-w-0 truncate" dir="auto">
              {item.title}
            </span>
            {item.hint ? (
              <kbd className="shrink-0 rounded border border-line bg-raised px-1.5 font-mono text-xs text-muted">{item.hint}</kbd>
            ) : (
              <span className="shrink-0 text-xs text-muted">{item.group}</span>
            )}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={cn('px-3 pt-2 text-sm text-muted', results.length > 0 && 'sr-only')}>
        {results.length === 0 ? 'No matching commands' : `${results.length} commands`}
      </p>
    </div>
  )
}

/** عرض لوحة الأوامر (بلا منطق): ↑ ↓ للتنقل، Enter للتنفيذ، Esc للإغلاق (من Dialog). تُصفَّر حالتها عند كل فتح. */
export function CommandPaletteView({
  open,
  items,
  onClose,
  onRun,
}: {
  open: boolean
  items: readonly PaletteItem[]
  onClose: () => void
  onRun: (item: PaletteItem) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Command palette" description="Run an action, or jump to a workspace.">
      <PaletteBody items={items} onRun={onRun} />
    </Dialog>
  )
}
