import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

export interface MenuItem {
  id: string
  label: string
  icon: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
}

interface DropdownMenuProps {
  /** اسم الزر لقارئ الشاشة، مثل "Actions for My Projects" */
  label: string
  items: readonly MenuItem[]
  className?: string
}

/**
 * قائمة منسدلة وفق نمط ARIA "menu button": أسهم للتنقل، Home/End، Escape للإغلاق مع إعادة التركيز للزر،
 * والنقر خارجها يغلقها. عند اختيار عنصر نُعيد التركيز للزر قبل تنفيذ الإجراء،
 * فإذا فتح الإجراء نافذة حوار فسيعود إليها التركيز الأصلي عند إغلاقها.
 */
export function DropdownMenu({ label, items, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const menuItems = (): HTMLElement[] =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = menuItems()
    const index = elements.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        elements[(index + 1) % elements.length]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        elements[(index - 1 + elements.length) % elements.length]?.focus()
        break
      case 'Home':
        event.preventDefault()
        elements[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        elements[elements.length - 1]?.focus()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div className={cn('relative', className)}>
      <IconButton
        ref={triggerRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className="size-9"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </IconButton>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1.5 min-w-52 origin-top-right animate-pop-in rounded-2xl border border-line bg-raised p-1.5 shadow-pop"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(true)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface',
                item.tone === 'danger' ? 'text-danger' : 'text-ink',
              )}
            >
              <span aria-hidden="true" className="shrink-0">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
