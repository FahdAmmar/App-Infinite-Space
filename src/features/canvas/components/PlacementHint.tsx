import { Panel } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvas-store-context'

const PLACE_LABELS = { sticky: 'a sticky note', text: 'a text card', link: 'a link card', group: 'a group' } as const

/** شريط صغير يوضح أن أداة إنشاء أو وصل مفعّلة وكيف يلغيها المستخدم. */
export function PlacementHint() {
  const tool = useCanvasStore((state) => state.tool)
  const hasSource = useCanvasStore((state) => state.connectSource !== null)

  let message: string | null = null
  if (tool === 'connect') {
    message = hasSource ? 'Now click the item to connect to' : 'Click the item to start from'
  } else if (tool === 'sticky' || tool === 'text' || tool === 'link' || tool === 'group') {
    message = `Click anywhere to place ${PLACE_LABELS[tool]}`
  }
  if (message === null) return null

  return (
    <Panel position="top-center" className="mt-16!">
      <p role="status" className="rounded-full border border-line bg-raised px-4 py-2 text-sm shadow-pop">
        {message} <span className="text-muted">· Esc to cancel</span>
      </p>
    </Panel>
  )
}
