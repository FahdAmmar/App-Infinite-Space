import { deserializeCanvas, serializeCanvas } from '../persistence/canvas-codec'
import type { StoredCanvas } from '@/services/persistence/storage-adapter'
import type { CanvasEdge } from '../types/edges'
import type { CanvasNode } from '../types/nodes'
import { buildClipboard, type CanvasClipboard } from './clipboard'
import { getAbsolutePosition } from './group-utils'
import { nodeLabel } from './outline'

/**
 * مقتطفات شخصية: تحديد من البطاقات (ومعه الوصلات الداخلية) يُحفظ باسم ويُدرج لاحقاً في أي مساحة.
 * التخزين بصيغة اللوحة نفسها (الترميز المُتحقَّق منه)، فكل ما يُقرأ من localStorage يمر بالتنظيف ذاته الذي تمر به أي لوحة.
 *
 * بلا صور عمداً: ملفات الصور تُحذف تلقائياً حين لا تشير إليها لوحة، فمقتطف يحتفظ بمعرّف صورة سيُظهر مكاناً فارغاً لاحقاً.
 * نعلم المستخدم بعدد ما تُخطّي بدل أن نُسقطه بصمت.
 */
export interface Snippet {
  id: string
  name: string
  createdAt: number
  canvas: StoredCanvas
}

export const MAX_SNIPPETS = 30
/** حجم المقتطف الواحد بعد التسلسل: يحمي حصة localStorage المشتركة (~5MB) مع بيانات التطبيق. */
export const MAX_SNIPPET_BYTES = 200_000
const NAME_MAX = 80
const EMPTY_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const

export type CreateSnippetResult =
  | { ok: true; snippet: Snippet; skippedImages: number }
  | { ok: false; reason: 'nothing-selected' | 'only-images' | 'too-large' }

/** اسم مقروء: أول بطاقة بترتيب القراءة، و«+ N» إن كان معها غيرها. */
export function snippetName(nodes: readonly CanvasNode[]): string {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const first = [...nodes]
    .filter((node) => node.type !== 'group')
    .sort((a, b) => {
      const pa = getAbsolutePosition(a, byId)
      const pb = getAbsolutePosition(b, byId)
      return pa.y - pb.y || pa.x - pb.x
    })[0]
  const base = first ? nodeLabel(first) : (nodes[0] ? nodeLabel(nodes[0]) : 'Snippet')
  const others = nodes.length - 1
  return (others > 0 ? `${base} + ${others}` : base).slice(0, NAME_MAX)
}

export function createSnippet(allNodes: readonly CanvasNode[], allEdges: readonly CanvasEdge[], id: string, now: number): CreateSnippetResult {
  const clip = buildClipboard(allNodes, allEdges)
  if (clip === null) return { ok: false, reason: 'nothing-selected' }
  const nodes = clip.nodes.filter((node) => node.type !== 'image')
  const skippedImages = clip.nodes.length - nodes.length
  if (nodes.length === 0) return { ok: false, reason: 'only-images' }
  const kept = new Set(nodes.map((node) => node.id))
  const edges = clip.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target))

  // بلا علامة تحديد ولا حالة مؤقتة: يمر الترميز المعتمد كما تُحفظ أي لوحة
  const canvas = serializeCanvas(
    nodes.map((node) => ({ ...node, selected: false })),
    edges.map((edge) => ({ ...edge, selected: false })),
    EMPTY_VIEWPORT,
  )
  if (JSON.stringify(canvas).length > MAX_SNIPPET_BYTES) return { ok: false, reason: 'too-large' }
  return { ok: true, snippet: { id, name: snippetName(nodes), createdAt: now, canvas }, skippedImages }
}

/** المقتطف كحافظة جاهزة للصق (تُنظَّف عند القراءة). null إن لم يبق فيه شيء صالح. */
export function snippetToClipboard(snippet: Snippet, now: number): CanvasClipboard | null {
  const { nodes, edges } = deserializeCanvas(snippet.canvas, now)
  return nodes.length === 0 ? null : { nodes, edges }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** قراءة مقتطفات من تخزين غير موثوق: أي مدخل تالف يُسقَط وحده، والباقي يعمل. */
export function sanitizeSnippets(raw: unknown, now: number): Snippet[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Snippet[] = []
  for (const item of raw) {
    if (out.length >= MAX_SNIPPETS) break
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || item.id.length > 64 || seen.has(item.id)) continue
    const canvas = item.canvas
    if (!isRecord(canvas) || !Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) continue
    const decoded = deserializeCanvas({ schemaVersion: 1, nodes: canvas.nodes, edges: canvas.edges, viewport: EMPTY_VIEWPORT }, now)
    const nodes = decoded.nodes.filter((node) => node.type !== 'image')
    if (nodes.length === 0) continue
    const kept = new Set(nodes.map((node) => node.id))
    const edges = decoded.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target))
    const name = typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim().slice(0, NAME_MAX) : snippetName(nodes)
    const createdAt = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : now
    seen.add(item.id)
    out.push({ id: item.id, name, createdAt, canvas: serializeCanvas(nodes, edges, EMPTY_VIEWPORT) })
  }
  return out
}
