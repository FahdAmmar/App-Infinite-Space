import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ToolButtonProps {
  label: string
  shortcut: string
  icon: LucideIcon
  active: boolean
  onSelect: () => void
  /** جهة ظهور التلميح: يمين الزر (شريط عمودي) أو فوقه (dock سفلي) */
  tooltipSide: 'right' | 'top'
  size?: 'md' | 'lg'
}

/**
 * زر أداة موحّد للشريط الجانبي والـ dock: الأداة النشطة بيضاء بأيقونة سوداء (وعكسها في الفاتح)
 * كما في المرجع الأول، مع تلميح داكن صغير يضم الاسم والمفتاح.
 */
export function ToolButton({ label, shortcut, icon: Icon, active, onSelect, tooltipSide, size = 'md' }: ToolButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        aria-keyshortcuts={shortcut}
        aria-pressed={active}
        onClick={onSelect}
        className={cn(
          'grid place-items-center rounded-xl transition-colors',
          size === 'lg' ? 'size-11' : 'size-10',
          active ? 'bg-primary text-primary-ink' : 'text-muted hover:bg-raised hover:text-ink',
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
      {/* تلميح مرئي عند التمرير أو تركيز لوحة المفاتيح (الاسم نفسه موجود في aria-label) */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-10 flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
          tooltipSide === 'right' ? 'top-1/2 left-full ml-3 -translate-y-1/2' : 'bottom-full left-1/2 mb-3 -translate-x-1/2',
        )}
      >
        {label}
        <kbd className="rounded bg-surface px-1.5 font-mono text-muted">{shortcut}</kbd>
      </span>
    </div>
  )
}
