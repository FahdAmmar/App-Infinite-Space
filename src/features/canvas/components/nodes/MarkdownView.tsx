import { memo, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { parseMarkdown, type Block, type Inline } from '../../utils/markdown'

function renderInline(nodes: readonly Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'text':
        return node.text
      case 'bold':
        return <strong key={index}>{renderInline(node.children)}</strong>
      case 'italic':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'code':
        return (
          <code key={index} className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em]">
            {node.text}
          </code>
        )
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onDoubleClick={(event) => event.stopPropagation()}
            className="nodrag nopan text-accent underline underline-offset-2"
          >
            {renderInline(node.children)}
          </a>
        )
    }
  })
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.kind) {
    case 'heading':
      return (
        <p key={index} dir="auto" className={cn('font-semibold tracking-tight', block.level === 1 ? 'text-[1.05rem]' : block.level === 2 ? 'text-[0.98rem]' : 'text-[0.92rem]')}>
          {renderInline(block.inline)}
        </p>
      )
    case 'paragraph':
      return (
        <p key={index} dir="auto" className="whitespace-pre-wrap">
          {renderInline(block.inline)}
        </p>
      )
    case 'quote':
      return (
        <blockquote key={index} dir="auto" className="border-s-2 border-line ps-2.5 whitespace-pre-wrap text-ink/70">
          {renderInline(block.inline)}
        </blockquote>
      )
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List key={index} dir="auto" className={cn('space-y-0.5 ps-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, i) => (
            <li key={i} className={item.task === null ? undefined : 'list-none'}>
              {item.task !== null && (
                <input
                  type="checkbox"
                  checked={item.task === 'done'}
                  disabled
                  aria-label={item.task === 'done' ? 'Done' : 'Not done'}
                  className="me-1.5 -ms-5 size-3.5 translate-y-0.5 accent-current"
                />
              )}
              <span className={item.task === 'done' ? 'text-ink/55 line-through' : undefined}>{renderInline(item.inline)}</span>
            </li>
          ))}
        </List>
      )
    }
  }
}

/** يعرض نص بطاقة بالماركداون الخفيف (انظر utils/markdown.ts). التحليل يُحفظ بين الرسمات ما لم يتغير النص. */
function MarkdownViewImpl({ source, className }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source])
  return <div className={cn('space-y-1.5', className)}>{blocks.map(renderBlock)}</div>
}

export const MarkdownView = memo(MarkdownViewImpl)
