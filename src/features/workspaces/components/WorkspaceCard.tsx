import { useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { useSpotlight } from '@/hooks/useSpotlight'
import { formatFullDate, formatRelativeTime } from '@/lib/time'
import type { WorkspaceMeta } from '../types/workspace'
import { WORKSPACE_COLORS } from '../utils/constants'
import { WorkspaceIcon } from './WorkspaceIcon'
import { WorkspacePreview } from './WorkspacePreview'

interface WorkspaceCardProps {
  workspace: WorkspaceMeta
  now: number
  onEdit: (workspace: WorkspaceMeta) => void
  onDuplicate: (workspace: WorkspaceMeta) => void
  onDelete: (workspace: WorkspaceMeta) => void
}

/**
 * بطاقة مساحة بتركيب بطاقات المرجع الأول: صف رأس (أيقونة + اسم + قائمة ⋯)
 * ثم إطار معاينة داخلي بحد رفيع، ثم الوصف وبيانات صغيرة.
 */
export function WorkspaceCard({ workspace, now, onEdit, onDuplicate, onDelete }: WorkspaceCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  useSpotlight(cardRef)
  const style = { '--ws': WORKSPACE_COLORS[workspace.color].hex } as CSSProperties

  const menuItems: MenuItem[] = [
    { id: 'edit', label: 'Rename & customize', icon: <Pencil className="size-4" />, onSelect: () => onEdit(workspace) },
    { id: 'duplicate', label: 'Duplicate', icon: <Copy className="size-4" />, onSelect: () => onDuplicate(workspace) },
    { id: 'delete', label: 'Delete', icon: <Trash2 className="size-4" />, onSelect: () => onDelete(workspace), tone: 'danger' },
  ]

  return (
    // البطاقة كلها رابط (عبر ::after على العنوان) والقائمة فوقها بـ z-index أعلى.
    // رفع z-index أثناء فتح القائمة يمنع بطاقات لاحقة من تغطيتها.
    <article
      ref={cardRef}
      style={style}
      className="magic-card group relative flex h-full flex-col rounded-[22px] border border-line bg-surface p-2.5 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--ws)_55%,var(--c-line))] hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent has-[[aria-expanded='true']]:z-20"
    >
      <div className="flex items-center gap-2.5 pt-0.5 pr-0.5 pb-2.5 pl-1.5">
        <span className="ws-chip grid size-7 shrink-0 place-items-center rounded-lg">
          <WorkspaceIcon id={workspace.icon} className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
          {/* bdi يعزل اتجاه الاسم (عربي/إنجليزي) دون أن تقفز محاذاته لليمين داخل واجهة LTR */}
          <Link
            to={`/w/${workspace.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-[22px] after:content-['']"
          >
            <bdi>{workspace.name}</bdi>
          </Link>
        </h3>
        <DropdownMenu label={`Actions for ${workspace.name}`} items={menuItems} className="relative z-10 shrink-0" />
      </div>

      <div className="ws-preview relative h-36 overflow-hidden rounded-[14px]">
        <WorkspacePreview preview={workspace.preview} icon={workspace.icon} />
      </div>

      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
        {workspace.description && (
          <p dir="auto" className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted">
            {workspace.description}
          </p>
        )}
        <p className="mt-auto flex items-center justify-between gap-3 text-xs text-muted">
          <span title={formatFullDate(workspace.updatedAt)}>Edited {formatRelativeTime(workspace.updatedAt, now)}</span>
          <span className="font-mono">
            {workspace.nodeCount === 0 ? 'Empty' : `${workspace.nodeCount} ${workspace.nodeCount === 1 ? 'item' : 'items'}`}
          </span>
        </p>
      </div>
    </article>
  )
}
