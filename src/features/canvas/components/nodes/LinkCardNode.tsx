import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ExternalLink, Globe, Link2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { LinkCard } from '../../types/nodes'
import { getDisplayHost, normalizeUrl } from '../../utils/link-url'
import { LinkContentEditor } from './LinkContentEditor'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'

/**
 * بطاقة رابط: عنوان ووصف يكتبهما المستخدم، واسم المضيف مع أيقونة ثابتة.
 * لا نجلب معاينة الصفحة من الإنترنت (لا خادم، وجلب عناوين عشوائية من المتصفح يفتح ثغرات خصوصية وأمان).
 * href يُعاد التحقق منه عند العرض حتى لو وصلت بيانات غير مُعقَّمة من التخزين لاحقاً (دفاع بطبقتين).
 */
function LinkCardNodeImpl({ id, data, selected }: NodeProps<LinkCard>) {
  const api = useCanvasStoreApi()
  const isEditing = useCanvasStore((state) => state.editingNodeId === id)
  const href = normalizeUrl(data.url)
  const host = href ? getDisplayHost(href) : null

  const startEditing = () => {
    if (api.getState().tool !== 'hand') api.getState().startEditing(id)
  }

  return (
    <NodeFrame id={id} type="link" selected={selected} editing={isEditing}>
      <div
        onDoubleClick={startEditing}
        className={cn('card-node flex h-full w-full flex-col overflow-hidden px-4 pt-3.5 pb-3.5 text-left text-ink', selected && 'card-node-selected')}
      >
        <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted">
          <Link2 className="size-3.5" aria-hidden="true" />
          Link
        </div>

        {isEditing ? (
          <LinkContentEditor
            initial={{ url: data.url, title: data.title, description: data.description }}
            onCommit={(value) => api.getState().updateNodeData(id, 'link', value)}
            onExit={() => api.getState().stopEditing(id)}
          />
        ) : href === null ? (
          <p className="text-[0.92rem] text-muted">Double-click to add a link</p>
        ) : (
          <>
            <p dir="auto" className="text-[1.02rem] leading-snug font-semibold tracking-tight break-words">
              {data.title !== '' ? data.title : host}
            </p>
            {data.description !== '' && (
              <p dir="auto" className="mt-1 line-clamp-3 min-h-0 text-[0.88rem] leading-relaxed break-words text-ink/75">
                {data.description}
              </p>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-2.5">
              <TagChips tags={data.tags} />
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${host} in a new tab`}
                className="nodrag nopan flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-ink"
              >
                <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                <span dir="ltr" className="min-w-0 flex-1 truncate">
                  {host}
                </span>
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </>
        )}
      </div>
    </NodeFrame>
  )
}

export const LinkCardNode = memo(LinkCardNodeImpl)
