import type { Viewport } from '@xyflow/react'
import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode, StickyColorId } from '@/features/canvas/types/nodes'
import { NODE_SIZES, ZOOM_LIMITS } from '@/features/canvas/utils/constants'
import { createEdge } from '@/features/canvas/utils/edge-utils'
import { reconcileAllMembership, sortGroupsFirst } from '@/features/canvas/utils/group-utils'
import { createGroup, createStickyNote } from '@/features/canvas/utils/node-factory'
import type { TemplateId } from '@/features/workspaces/templates/template-catalog'

export interface TemplateCanvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
}

const { width: NOTE_W, height: NOTE_H } = NODE_SIZES.sticky

/** ورقة بزاويتها العليا اليسرى عند (x, y) ومحتواها نص جاهز يوضح ما يُكتب مكانه. */
function note(x: number, y: number, content: string, color: StickyColorId, now: number): CanvasNode {
  const sticky = createStickyNote({ x: x + NOTE_W / 2, y: y + NOTE_H / 2 }, now, color)
  return { ...sticky, data: { ...sticky.data, content } }
}

/** إطار (مجموعة) بزاويته العليا اليسرى وحجمه، وعنوانه ظاهر في شريطه. */
function frame(x: number, y: number, width: number, height: number, label: string, now: number): CanvasNode {
  const group = createGroup({ x: x + width / 2, y: y + height / 2 }, now)
  return { ...group, position: { x, y }, width, height, data: { ...group.data, label } }
}

const link = (from: CanvasNode, to: CanvasNode, fromSide: 'left' | 'right', toSide: 'left' | 'right'): CanvasEdge =>
  createEdge(from.id, to.id, fromSide, toSide)

/** إطار العرض الذي يُظهر كل المحتوى وسط شاشة بحجم عادي (نحو 1200×720) دون تكبير يتجاوز 100%. */
export function fitViewport(nodes: readonly CanvasNode[], screen = { width: 1200, height: 720 }, padding = 80): Viewport {
  if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 }
  const left = Math.min(...nodes.map((node) => node.position.x))
  const top = Math.min(...nodes.map((node) => node.position.y))
  const right = Math.max(...nodes.map((node) => node.position.x + (node.width ?? NOTE_W)))
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.height ?? NOTE_H)))
  const zoom = Math.min(1, (screen.width - padding * 2) / (right - left), (screen.height - padding * 2) / (bottom - top))
  const clamped = Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, zoom))
  return {
    x: screen.width / 2 - ((left + right) / 2) * clamped,
    y: screen.height / 2 - ((top + bottom) / 2) * clamped,
    zoom: clamped,
  }
}

function mindMap(now: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const center = note(-NOTE_W / 2, -NOTE_H / 2, 'Main idea', 'purple', now)
  const nodes: CanvasNode[] = [center]
  const edges: CanvasEdge[] = []
  // أربعة فروع، لكل منها فرعان ثانويان؛ اليمين يخرج من يمين المركز واليسار من يساره
  const branches = [
    { side: 'right', y: -380, color: 'blue', label: 'Branch one', subs: ['Detail', 'Detail'] },
    { side: 'right', y: 160, color: 'green', label: 'Branch two', subs: ['Detail', 'Detail'] },
    { side: 'left', y: -380, color: 'pink', label: 'Branch three', subs: ['Detail', 'Detail'] },
    { side: 'left', y: 160, color: 'yellow', label: 'Branch four', subs: ['Detail', 'Detail'] },
  ] as const
  for (const branch of branches) {
    const east = branch.side === 'right'
    const bx = east ? 340 : -340 - NOTE_W
    const head = note(bx, branch.y, branch.label, branch.color, now)
    nodes.push(head)
    edges.push(link(center, head, branch.side, east ? 'left' : 'right'))
    branch.subs.forEach((text, index) => {
      const sx = east ? 700 : -700 - NOTE_W
      const sub = note(sx, branch.y - 110 + index * 250, text, branch.color, now)
      nodes.push(sub)
      edges.push(link(head, sub, branch.side, east ? 'left' : 'right'))
    })
  }
  return { nodes, edges }
}

function columns(
  now: number,
  specs: readonly { label: string; color: StickyColorId; cards: readonly string[] }[],
  columnWidth = 360,
  gap = 40,
): { nodes: CanvasNode[]; edges: CanvasEdge[]; cards: CanvasNode[][] } {
  const tallest = Math.max(...specs.map((spec) => spec.cards.length), 1)
  const height = 72 + tallest * (NOTE_H + 20) + 20
  const total = specs.length * columnWidth + (specs.length - 1) * gap
  const nodes: CanvasNode[] = []
  const cards: CanvasNode[][] = []
  specs.forEach((spec, column) => {
    const x = -total / 2 + column * (columnWidth + gap)
    nodes.push(frame(x, -height / 2, columnWidth, height, spec.label, now))
    cards[column] = spec.cards.map((text, row) => note(x + (columnWidth - NOTE_W) / 2, -height / 2 + 64 + row * (NOTE_H + 20), text, spec.color, now))
    nodes.push(...cards[column])
  })
  return { nodes, edges: [], cards }
}

function quadrants(now: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const w = 520
  const h = 360
  const gap = 40
  const specs = [
    { label: 'Strengths', color: 'green', text: 'What are you good at?' },
    { label: 'Weaknesses', color: 'pink', text: 'What could be better?' },
    { label: 'Opportunities', color: 'blue', text: 'What could you take advantage of?' },
    { label: 'Threats', color: 'yellow', text: 'What could get in the way?' },
  ] as const
  const nodes: CanvasNode[] = []
  specs.forEach((spec, index) => {
    const x = -w - gap / 2 + (index % 2) * (w + gap)
    const y = -h - gap / 2 + Math.floor(index / 2) * (h + gap)
    nodes.push(frame(x, y, w, h, spec.label, now), note(x + (w - NOTE_W) / 2, y + 80, spec.text, spec.color, now))
  })
  return { nodes, edges: [] }
}

function build(id: Exclude<TemplateId, 'blank'>, now: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  switch (id) {
    case 'mind-map':
      return mindMap(now)
    case 'kanban': {
      const board = columns(now, [
        { label: 'To do', color: 'blue', cards: ['Write the brief', 'Sketch a first version', 'Ask for feedback'] },
        { label: 'Doing', color: 'yellow', cards: ['Build the prototype'] },
        { label: 'Done', color: 'green', cards: ['Choose a name'] },
      ])
      return { nodes: board.nodes, edges: [] }
    }
    case 'swot':
      return quadrants(now)
    case 'retrospective': {
      const board = columns(
        now,
        [
          { label: 'Went well', color: 'green', cards: ['What are you proud of?'] },
          { label: 'To improve', color: 'pink', cards: ['What slowed you down?'] },
          { label: 'Actions', color: 'purple', cards: ['What will you try next time?'] },
        ],
        400,
      )
      return { nodes: board.nodes, edges: [] }
    }
    case 'roadmap': {
      const board = columns(
        now,
        [
          { label: 'Now', color: 'green', cards: ['Ship the first version'] },
          { label: 'Next', color: 'blue', cards: ['Gather feedback'] },
          { label: 'Later', color: 'purple', cards: ['Plan version two'] },
          { label: 'Ideas', color: 'neutral', cards: ['Something to explore'] },
        ],
        320,
      )
      const [now1, next1, later1] = [board.cards[0]?.[0], board.cards[1]?.[0], board.cards[2]?.[0]]
      const edges = now1 && next1 && later1 ? [link(now1, next1, 'right', 'left'), link(next1, later1, 'right', 'left')] : []
      return { nodes: board.nodes, edges }
    }
  }
}

/**
 * بطاقات قالب جاهز ووصلاته وعرضه الأولي. يُبنى بمصانع التطبيق نفسها، ثم تُسند العضوية في الإطارات بالقاعدة نفسها التي
 * تطبقها اللوحة عند السحب (فتصير الأوراق أبناء إطاراتها وتتحرك معها)، ويمر الناتج بعد ذلك عبر مُحقِّق الاستيراد.
 * `screen` مقاس الشاشة التي سيفتح عليها القالب (النافذة الحالية) كي يتوسطها المحتوى؛ الافتراضي شاشة عادية.
 * القالب الفارغ لا بطاقات له.
 */
export function buildTemplateCanvas(id: TemplateId, now: number, screen?: { width: number; height: number }): TemplateCanvas {
  if (id === 'blank') return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
  const { nodes, edges } = build(id, now)
  const placed = reconcileAllMembership(sortGroupsFirst(nodes))
  return { nodes: placed, edges, viewport: fitViewport(nodes, screen) }
}
