import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { formatRelativeTime } from '@/lib/time'
import type { WorkspaceMeta } from '../types/workspace'
import { WORKSPACE_COLORS } from '../utils/constants'
import { WorkspaceIcon } from './WorkspaceIcon'

interface RecentListProps {
  workspaces: readonly WorkspaceMeta[]
  now: number
}

/** صفوف مدمجة (وليست بطاقات) للعودة السريعة؛ تمييزها بصرياً عن الشبكة يمنع الشعور بالتكرار. */
export function RecentList({ workspaces, now }: RecentListProps) {
  if (workspaces.length === 0) return null

  return (
    <section aria-labelledby="recent-heading" data-reveal="hero">
      <h2 id="recent-heading" className="text-sm font-semibold text-muted">
        Pick up where you left off
      </h2>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <Link
              to={`/w/${workspace.id}`}
              style={{ '--ws': WORKSPACE_COLORS[workspace.color].hex } as CSSProperties}
              className="flex items-center gap-3 rounded-full border border-line bg-surface py-2 pr-4 pl-2 transition-colors hover:bg-raised hover:border-[color-mix(in_oklab,var(--ws)_55%,var(--c-line))]"
            >
              <span className="ws-chip grid size-9 shrink-0 place-items-center rounded-full">
                <WorkspaceIcon id={workspace.icon} className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  <bdi>{workspace.name}</bdi>
                </span>
                <span className="block text-xs text-muted">
                  Opened {formatRelativeTime(workspace.lastOpenedAt ?? workspace.updatedAt, now)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
