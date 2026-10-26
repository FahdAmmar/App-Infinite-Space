import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/** حقل البحث بشكل حبّة (مرجع 4): يعيش في الشريط العلوي الثابت فيبقى متاحاً أثناء التمرير. */
export function SearchField({ value, onChange, className }: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <label htmlFor="workspace-search" className="sr-only">
        Search workspaces
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        id="workspace-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search workspaces"
        autoComplete="off"
        className="h-11 w-full rounded-full border border-line bg-raised pr-4 pl-11 text-sm placeholder:text-muted/80 hover:border-muted/50 focus:border-accent"
      />
    </div>
  )
}
