import { Dialog } from '@/components/ui/Dialog'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'

const GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<readonly [string, string]> }> = [
  {
    title: 'Create',
    items: [
      ['Double-click canvas', 'New sticky note'],
      ['N', 'Sticky note at the pointer'],
      ['T', 'Text card at the pointer'],
      ['L', 'Link card at the pointer'],
      ['G', 'Group at the pointer'],
      ['I', 'Add images from your device'],
      ['Drop or paste an image', 'Add it to the canvas'],
      ['F2', 'Edit the selected item'],
    ],
  },
  {
    title: 'Select and edit',
    items: [
      ['V / H / C', 'Select / Hand / Connect tool'],
      ['Drag from a dot', 'Connect two items'],
      ['Shift + drag', 'Box select'],
      ['Shift, Ctrl or ⌘ + click', 'Add to selection'],
      ['Ctrl/⌘ + A', 'Select all'],
      ['Ctrl/⌘ + Z', 'Undo'],
      ['Ctrl/⌘ + Shift + Z, Ctrl + Y', 'Redo'],
      ['Ctrl/⌘ + D', 'Duplicate selection'],
      ['Delete / Backspace', 'Delete selection'],
      ['Esc', 'Finish editing, cancel a tool, clear selection'],
    ],
  },
  {
    title: 'Navigate',
    items: [
      ['Drag background · Hand tool (H)', 'Pan'],
      ['Scroll · pinch', 'Zoom'],
      ['+ / −', 'Zoom in / out'],
      ['Shift + 1', 'Fit all content'],
      ['Shift + 2', 'Zoom to selection'],
      ['?', 'Show this list'],
    ],
  },
]

export function ShortcutsDialog() {
  const api = useCanvasStoreApi()
  const open = useCanvasStore((state) => state.shortcutsOpen)

  return (
    <Dialog open={open} onClose={() => api.getState().setShortcutsOpen(false)} title="Keyboard shortcuts">
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 font-display text-sm font-semibold tracking-tight text-muted">{group.title}</h3>
            <dl className="space-y-1.5">
              {group.items.map(([keys, action]) => (
                <div key={keys} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="font-mono text-xs text-ink">{keys}</dt>
                  <dd className="text-right text-muted">{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
