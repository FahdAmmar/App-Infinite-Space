import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type KeyboardEvent, type SyntheticEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** 'lg' للمحتوى العريض مثل معاينة الصور */
  size?: 'md' | 'lg'
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * نافذة حوار مبنية على عنصر <dialog> الأصلي: يوفر طبقة علوية (top layer)،
 * وتعطيل الخلفية، ومفتاح Escape. نضيف فوقه:
 *  - فخ تركيز يدوي، لأن Chromium يُخرج التركيز إلى <body> عندما يكون في النافذة عنصر واحد قابل للتركيز.
 *  - إغلاق عند الضغط على الخلفية، بشرط أن يبدأ الضغط وينتهي عليها (حتى لا تُغلق عند سحب تحديد نص).
 *  - عنصر التركيز الأولي عبر data-autofocus.
 */
export function Dialog({ open, onClose, title, description, size = 'md', children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const handleCancel = (event: SyntheticEvent) => {
    // Escape: نمنع الإغلاق التلقائي ونسلّم القرار للمكوّن الأب ليبقى الحالة متسقة
    event.preventDefault()
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
      event.preventDefault()
      return
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handlePointerDown = (event: MouseEvent<HTMLDialogElement>) => {
    pressStartedOnBackdrop.current = event.target === event.currentTarget
  }

  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      onMouseDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        'm-auto max-h-[92dvh] overflow-visible rounded-3xl border border-line bg-raised p-0 text-ink shadow-pop open:animate-dialog-in backdrop:bg-black/55 backdrop:backdrop-blur-[2px]',
        size === 'lg' ? 'w-[min(94vw,62rem)]' : 'w-[min(92vw,32rem)]',
      )}
    >
      {/* المحتوى لا يُرسم إلا والنافذة مفتوحة، فتُصفَّر حالة النماذج تلقائياً عند كل فتح */}
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close dialog" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
              <X className="size-5" aria-hidden="true" />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-6 pb-6 pt-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
