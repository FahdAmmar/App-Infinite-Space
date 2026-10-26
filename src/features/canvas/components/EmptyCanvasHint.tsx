import { StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCanvasStore } from '@/stores/canvas-store-context'
import { selectNodeCount } from '@/stores/canvas-selectors'
import type { CanvasCommands } from '../hooks/useCanvasCommands'

/**
 * إرشاد يظهر فقط والوحة فارغة. الحاوية لا تلتقط الفأرة (pointer-events-none) كي لا تمنع السحب
 * والتكبير على اللوحة تحتها؛ الزر وحده يلتقطها. الزر ضروري لمستخدمي اللمس الذين لا ينقرون مرتين بسهولة.
 */
export function EmptyCanvasHint({ commands }: { commands: CanvasCommands }) {
  const isEmpty = useCanvasStore((state) => selectNodeCount(state) === 0)
  if (!isEmpty) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] grid place-items-center p-6">
      <section aria-labelledby="canvas-empty-heading" className="max-w-sm text-center">
        <h2 id="canvas-empty-heading" className="font-display text-2xl font-bold tracking-tight">
          A blank canvas
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>Double-click anywhere to add a sticky note.</li>
          <li>
            Press <kbd className="rounded border border-line bg-raised px-1.5 font-mono text-xs">N</kbd> for a note or{' '}
            <kbd className="rounded border border-line bg-raised px-1.5 font-mono text-xs">T</kbd> for a text card.
          </li>
          <li>Drop or paste images, press <kbd className="rounded border border-line bg-raised px-1.5 font-mono text-xs">L</kbd> for a link.</li>
          <li>Drag from the dots on a card to connect it to another.</li>
          <li>Drag the background to pan, scroll or pinch to zoom.</li>
        </ul>
        <Button variant="primary" onClick={() => commands.addNodeAtPointer('sticky')} className="pointer-events-auto mt-5">
          <StickyNote className="size-5" aria-hidden="true" />
          Add a sticky note
        </Button>
      </section>
    </div>
  )
}
