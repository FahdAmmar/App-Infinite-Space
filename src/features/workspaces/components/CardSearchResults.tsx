import { Link } from 'react-router'
import { FileText, Image as ImageIcon, Layers, Link as LinkIcon, ListChecks, Shapes, Video, StickyNote, Type } from 'lucide-react'
import { buildCardLink } from '@/features/canvas/utils/card-link'
import type { CardHit } from '../utils/card-search'

const KIND_ICON = { sticky: StickyNote, text: Type, image: ImageIcon, link: LinkIcon, checklist: ListChecks, shape: Shapes, video: Video, group: Layers } as const

/** بطاقات من داخل المساحات تطابق البحث؛ النقر يفتح المساحة عند البطاقة نفسها (رابط عميق). */
export function CardSearchResults({ hits, searching, query }: { hits: readonly CardHit[]; searching: boolean; query: string }) {
  if (!searching && hits.length === 0) return null
  return (
    <section aria-labelledby="card-results-heading" className="space-y-3">
      <h2 id="card-results-heading" className="font-display text-xl font-semibold tracking-tight">
        Cards matching “<bdi>{query.trim()}</bdi>”
        {!searching && <span className="ml-2.5 font-mono text-sm font-normal text-muted">{hits.length}</span>}
      </h2>
      {searching ? (
        <p role="status" className="text-sm text-muted">
          Searching inside your workspaces…
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {hits.map((hit) => {
            const Icon = KIND_ICON[hit.kind] ?? FileText
            const to = new URL(buildCardLink(window.location.origin, hit.workspaceId, hit.nodeId))
            return (
              <li key={`${hit.workspaceId}:${hit.nodeId}`}>
                <Link
                  to={`${to.pathname}${to.search}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 transition-colors hover:bg-raised"
                >
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-sm font-medium">
                      {hit.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      in <bdi>{hit.workspaceName}</bdi>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
