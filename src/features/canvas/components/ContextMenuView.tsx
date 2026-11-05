import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { clampMenuPosition, menuSize, type MenuActionId, type MenuEntry } from '../utils/context-menu'

interface ContextMenuViewProps {
  entries: readonly MenuEntry[]
  /** نقطة النقر بإحداثيات النافذة */
  point: { x: number; y: number }
  onSelect: (id: MenuActionId) => void
  onClose: () => void
}

/**
 * قائمة النقر الأيمن: عرض فقط (الأوامر ينفذها CanvasContextMenu).
 * - الموضع يُحسب من حجم ثابت (انظر menuSize) فلا قياس DOM ولا وميض عند الفتح، وتنقلب عن حافات النافذة.
 * - لوحة المفاتيح: الأسهم وHome وEnd للتنقل (تتخطى المعطّل)، Enter/Space للتنفيذ، Esc وTab للإغلاق.
 * - تُغلق بالنقر خارجها أو بالتمرير أو بتغيير حجم النافذة أو بفقدان التركيز عن النافذة.
 */
export function ContextMenuView({ entries, point, onSelect, onClose }: ContextMenuViewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const position = clampMenuPosition(point, menuSize(entries), { width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    // التركيز على أول أمر متاح كي تعمل لوحة المفاتيح فوراً (القائمة فتحها نقر، لكن مستخدم المفاتيح يتابع بها)
    rootRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true })
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return
      onClose()
    }
    window.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('wheel', onClose, { passive: true })
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    const index = buttons.findIndex((button) => button === document.activeElement)
    const focusAt = (next: number) => {
      event.preventDefault()
      buttons[(next + buttons.length) % buttons.length]?.focus()
    }
    if (event.key === 'ArrowDown') focusAt(index + 1)
    else if (event.key === 'ArrowUp') focusAt(index <= 0 ? -1 : index - 1)
    else if (event.key === 'Home') focusAt(0)
    else if (event.key === 'End') focusAt(-1)
    else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation() // Esc هنا يغلق القائمة فقط؛ لا يمسح التحديد ولا التصفية خلفها
      onClose()
    }
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Canvas actions"
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: position.x, top: position.y }}
      className="fixed z-50 w-[232px] rounded-2xl border border-line bg-surface/95 p-1.5 shadow-pop backdrop-blur-md"
    >
      {entries.map((entry, index) =>
        entry === 'separator' ? (
          <div key={`sep-${index}`} role="separator" className="mx-2 my-1 h-px bg-line" />
        ) : (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => onSelect(entry.id)}
            className={cn(
              'flex h-9 w-full items-center justify-between gap-4 rounded-xl px-3 text-left text-sm outline-none transition-colors',
              'hover:bg-raised focus-visible:bg-raised focus-visible:ring-2 focus-visible:ring-accent',
              entry.danger ? 'text-danger' : 'text-ink',
              entry.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
            )}
          >
            <span className="truncate">{entry.label}</span>
            {entry.hint !== undefined && <kbd className="shrink-0 font-mono text-[11px] text-muted">{entry.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  )
}
