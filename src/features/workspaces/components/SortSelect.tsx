import { ArrowDownUp } from 'lucide-react'
import type { WorkspaceSortKey } from '../types/workspace'
import { SORT_OPTIONS } from '../utils/constants'

interface SortSelectProps {
  value: WorkspaceSortKey
  onChange: (sort: WorkspaceSortKey) => void
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="relative">
      <label htmlFor="workspace-sort" className="sr-only">
        Sort workspaces by
      </label>
      <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <select
        id="workspace-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as WorkspaceSortKey)}
        className="h-10 appearance-none rounded-full border border-line bg-surface pr-4 pl-10 text-sm hover:border-muted/50"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
