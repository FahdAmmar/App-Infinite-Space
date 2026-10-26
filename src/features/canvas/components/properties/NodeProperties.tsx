import type { ReactNode } from 'react'
import { Copy, ExternalLink, Layers, Link2, Maximize2, Replace, StickyNote as StickyIcon, Trash2, Type } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useImageUrl } from '../../hooks/useImageUrl'
import type { CanvasCommands } from '../../hooks/useCanvasCommands'
import type { CanvasNode, ImageCard } from '../../types/nodes'
import { STICKY_COLOR_IDS } from '../../types/nodes'
import {
  DESCRIPTION_MAX_LENGTH,
  GROUP_LABEL_MAX_LENGTH,
  getResizeLimits,
  STICKY_COLORS,
  TEXT_COLORS,
  TITLE_MAX_LENGTH,
  CONTENT_MAX_LENGTH,
  URL_MAX_LENGTH,
} from '../../utils/constants'
import { getAbsolutePosition, getNodeSize } from '../../utils/group-utils'
import { getDisplayHost, normalizeUrl } from '../../utils/link-url'
import { ColorSwatches, CommitField, NumberField, PanelSection, ReadOnlyValue, TagEditor } from './controls'

const NODE_TITLES: Record<CanvasNode['type'], { label: string; icon: ReactNode }> = {
  sticky: { label: 'Sticky note', icon: <StickyIcon className="size-4" aria-hidden="true" /> },
  text: { label: 'Text card', icon: <Type className="size-4" aria-hidden="true" /> },
  image: { label: 'Image', icon: <Maximize2 className="size-4" aria-hidden="true" /> },
  link: { label: 'Link', icon: <Link2 className="size-4" aria-hidden="true" /> },
  group: { label: 'Group', icon: <Layers className="size-4" aria-hidden="true" /> },
}

/** عنوان اللوحة لنوع العقدة: أيقونة واسم */
export function NodePanelTitle({ type }: { type: CanvasNode['type'] }) {
  const { icon, label } = NODE_TITLES[type]
  return (
    <>
      {icon}
      <span className="truncate">{label}</span>
    </>
  )
}

const STICKY_SWATCHES = STICKY_COLOR_IDS.map((id) => ({
  id,
  label: STICKY_COLORS[id].label,
  background: STICKY_COLORS[id].bg,
  border: STICKY_COLORS[id].border,
}))

/** الحجم والموضع: مشتركان بين كل الأنواع (الصور بالعرض فقط لأن ارتفاعها يتبع نسبتها). */
function GeometrySection({ node }: { node: CanvasNode }) {
  const api = useCanvasStoreApi()
  const parent = useCanvasStore((state) => (node.parentId ? state.nodes.find((n) => n.id === node.parentId) : undefined))
  const size = getNodeSize(node)
  const limits = getResizeLimits(node.type)
  const absolute = getAbsolutePosition(node, new Map(parent ? [[parent.id, parent]] : []))

  return (
    <PanelSection title="Size and position">
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField
          label="Width"
          value={size.width}
          min={limits.minWidth}
          max={limits.maxWidth}
          onCommit={(width) => api.getState().resizeNode(node.id, { width })}
        />
        {node.type === 'image' ? (
          <ReadOnlyValue label="Height (follows ratio)" value={`${Math.round(size.height)}`} />
        ) : (
          <NumberField
            label="Height"
            value={size.height}
            min={limits.minHeight}
            max={limits.maxHeight}
            onCommit={(height) => api.getState().resizeNode(node.id, { height })}
          />
        )}
        <ReadOnlyValue label="X" value={`${Math.round(absolute.x)}`} />
        <ReadOnlyValue label="Y" value={`${Math.round(absolute.y)}`} />
      </div>
      {parent?.type === 'group' && (
        <p className="text-xs text-muted">
          Inside group “{parent.data.label !== '' ? parent.data.label : 'Group'}”. Drag it out to release it.
        </p>
      )}
    </PanelSection>
  )
}

function ImageThumb({ node }: { node: ImageCard }) {
  const image = useImageUrl(node.data.imageId)
  return (
    <div
      style={{ aspectRatio: `${node.data.naturalWidth} / ${node.data.naturalHeight}` }}
      className="max-h-40 w-full overflow-hidden rounded-xl border border-line bg-bg"
    >
      {image.status === 'ready' && <img src={image.url} alt="" className="size-full object-contain" />}
      {image.status === 'loading' && <div aria-hidden="true" className="size-full animate-pulse bg-raised" />}
      {image.status === 'missing' && <p className="grid size-full place-items-center p-3 text-center text-xs text-muted">Image unavailable</p>}
    </div>
  )
}

function Fields({ node, commands }: { node: CanvasNode; commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const update = api.getState().updateNodeData

  switch (node.type) {
    case 'sticky':
      return (
        <>
          <PanelSection title="Content">
            <CommitField label="Title" value={node.data.title} maxLength={TITLE_MAX_LENGTH} onCommit={(title) => update(node.id, 'sticky', { title })} />
            <CommitField label="Text" multiline value={node.data.content} maxLength={CONTENT_MAX_LENGTH} onCommit={(content) => update(node.id, 'sticky', { content })} />
          </PanelSection>
          <PanelSection title="Style">
            <p className="text-xs text-muted">Background</p>
            <ColorSwatches label="Background color" options={STICKY_SWATCHES} value={node.data.color} onChange={(color) => update(node.id, 'sticky', { color })} />
            <p className="pt-1 text-xs text-muted">Text color</p>
            <ColorSwatches
              label="Text color"
              options={TEXT_COLORS.map((c) => ({ id: c.id, label: c.label, background: c.value ?? 'var(--c-muted)', border: 'var(--c-line)' }))}
              value={TEXT_COLORS.find((c) => c.value === node.data.textColor)?.id ?? null}
              onChange={(id) => update(node.id, 'sticky', { textColor: TEXT_COLORS.find((c) => c.id === id)?.value ?? null })}
            />
          </PanelSection>
          <PanelSection title="Tags">
            <TagEditor tags={node.data.tags} onChange={(tags) => update(node.id, 'sticky', { tags })} />
          </PanelSection>
        </>
      )
    case 'text':
      return (
        <>
          <PanelSection title="Content">
            <CommitField label="Title" value={node.data.title} maxLength={TITLE_MAX_LENGTH} onCommit={(title) => update(node.id, 'text', { title })} />
            <CommitField label="Text" multiline value={node.data.content} maxLength={CONTENT_MAX_LENGTH} onCommit={(content) => update(node.id, 'text', { content })} />
          </PanelSection>
          <PanelSection title="Tags">
            <TagEditor tags={node.data.tags} onChange={(tags) => update(node.id, 'text', { tags })} />
          </PanelSection>
        </>
      )
    case 'image':
      return (
        <>
          <PanelSection title="Image">
            <ImageThumb node={node} />
            <ReadOnlyValue label="Original size" value={`${node.data.naturalWidth} × ${node.data.naturalHeight} px`} />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => commands.replaceImage(node.id)} aria-label="Replace image" className="min-w-0 flex-1 px-2">
                <Replace className="size-4 shrink-0" aria-hidden="true" />
                Replace
              </Button>
              <Button variant="secondary" size="sm" onClick={() => api.getState().setPreviewNode(node.id)} className="min-w-0 flex-1 px-2">
                <Maximize2 className="size-4 shrink-0" aria-hidden="true" />
                Preview
              </Button>
            </div>
          </PanelSection>
          <PanelSection title="Caption">
            <CommitField label="Title" value={node.data.title} maxLength={TITLE_MAX_LENGTH} onCommit={(title) => update(node.id, 'image', { title })} />
            <CommitField label="Description" multiline value={node.data.description} maxLength={DESCRIPTION_MAX_LENGTH} onCommit={(description) => update(node.id, 'image', { description })} />
          </PanelSection>
          <PanelSection title="Tags">
            <TagEditor tags={node.data.tags} onChange={(tags) => update(node.id, 'image', { tags })} />
          </PanelSection>
        </>
      )
    case 'link': {
      const href = normalizeUrl(node.data.url)
      return (
        <>
          <PanelSection title="Link">
            <CommitField
              label="Web address"
              value={node.data.url}
              maxLength={URL_MAX_LENGTH}
              placeholder="https://example.com"
              dir="ltr"
              parse={(draft) => {
                if (draft.trim() === '') return { ok: true, value: '' }
                const normalized = normalizeUrl(draft)
                return normalized ? { ok: true, value: normalized } : { ok: false, error: 'Enter a valid http or https web address.' }
              }}
              onCommit={(url) => update(node.id, 'link', { url })}
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent underline-offset-2 hover:underline"
              >
                Open {getDisplayHost(href)}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
            <CommitField label="Title" value={node.data.title} maxLength={TITLE_MAX_LENGTH} onCommit={(title) => update(node.id, 'link', { title })} />
            <CommitField label="Description" multiline value={node.data.description} maxLength={DESCRIPTION_MAX_LENGTH} onCommit={(description) => update(node.id, 'link', { description })} />
          </PanelSection>
          <PanelSection title="Tags">
            <TagEditor tags={node.data.tags} onChange={(tags) => update(node.id, 'link', { tags })} />
          </PanelSection>
        </>
      )
    }
    case 'group':
      return (
        <>
          <PanelSection title="Group">
            <CommitField label="Name" value={node.data.label} maxLength={GROUP_LABEL_MAX_LENGTH} placeholder="Ideas, Research, Done…" onCommit={(label) => update(node.id, 'group', { label })} />
            <p className="text-xs text-muted">Color</p>
            <ColorSwatches label="Group color" options={STICKY_SWATCHES} value={node.data.color} onChange={(color) => update(node.id, 'group', { color })} />
          </PanelSection>
          <PanelSection title="How groups work">
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
              <li>Drop an item so its center is inside the frame to add it.</li>
              <li>Move the frame by its title bar; its items move with it.</li>
              <li>Resizing the frame adds or releases items. Deleting it keeps the items.</li>
            </ul>
          </PanelSection>
        </>
      )
  }
}

/** لوحة خصائص عقدة واحدة: حقول النوع، ثم الحجم والموضع، ثم الإجراءات. */
export function NodeProperties({ node, commands }: { node: CanvasNode; commands: CanvasCommands }) {
  return (
    <>
      <Fields node={node} commands={commands} />
      <GeometrySection node={node} />
      <PanelSection title="Actions">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={commands.duplicateSelection}>
            <Copy className="size-4" aria-hidden="true" />
            Duplicate
          </Button>
          {node.type !== 'group' && (
            <Button variant="secondary" size="sm" onClick={() => commands.startConnectFrom(node.id)}>
              <Link2 className="size-4" aria-hidden="true" />
              Connect to…
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={commands.deleteSelection} className="hover:text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
            {node.type === 'image' ? 'Delete image' : 'Delete'}
          </Button>
        </div>
      </PanelSection>
    </>
  )
}
