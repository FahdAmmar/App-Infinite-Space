import type { Viewport } from '@xyflow/react'
import type { StoredCanvas } from '@/services/persistence/storage-adapter'
import type { CanvasEdge, CanvasEdgeData } from '../types/edges'
import { EDGE_ARROWS, EDGE_COLOR_IDS, EDGE_CURVES, EDGE_LINE_STYLES } from '../types/edges'
import type { BaseNodeData, CanvasNode, GroupContainer, StickyColorId } from '../types/nodes'
import { STICKY_COLOR_IDS } from '../types/nodes'
import {
  CANVAS_LIMITS,
  CONTENT_MAX_LENGTH,
  DEFAULT_EDGE_DATA,
  DEFAULT_STICKY_COLOR,
  DESCRIPTION_MAX_LENGTH,
  EDGE_LABEL_MAX_LENGTH,
  GROUP_LABEL_MAX_LENGTH,
  IMAGE_LIMITS,
  MAX_TAGS,
  NODE_SIZES,
  TITLE_MAX_LENGTH,
  ZOOM_LIMITS,
  getResizeLimits,
} from '../utils/constants'
import { isHandleSide } from '../utils/edge-utils'
import { sortGroupsFirst } from '../utils/group-utils'
import { normalizeUrl } from '../utils/link-url'
import { addTag } from '../utils/tags'

/**
 * التحويل بين حالة اللوحة والصيغة المخزَّنة.
 *
 * serialize: نحتفظ بما يُعاد به بناء اللوحة فقط (المعرّف، النوع، الموضع، الحجم، المجموعة، البيانات)،
 * ونحذف حالات React Flow المؤقتة (selected, dragging, measured, resizing...) فلا تُخزَّن ولا تتسرب.
 *
 * deserialize: المخزَّن «غير موثوق» (قد يعدّله المستخدم، أو يكتبه إصدار قديم أو جديد أو متصفح تالف).
 * لذلك نعيد بناء كل عقدة ووصلة من حقولها المعروفة بعد التحقق، ونُصلح ما يمكن إصلاحه، ونتجاهل ما لا يمكن
 * (مع عدّه كي يُبلَّغ المستخدم) بدل أن يكسر عنصر تالف واحد فتح المساحة كلها.
 * أمثلة: عنوان رابط بروتوكوله javascript: يُفرَّغ (دفاع ثانٍ بعد التحقق عند الإدخال)، وعقدة موضعها NaN تُحذف،
 * ووصلة إلى عقدة غير موجودة تُحذف، وأب غير موجود يُلغى.
 */

export const MAX_NODES = CANVAS_LIMITS.maxNodes
export const MAX_EDGES = CANVAS_LIMITS.maxEdges
const MAX_COORDINATE = 10_000_000

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

const STICKY_IDS: readonly string[] = STICKY_COLOR_IDS
function stickyColor(value: unknown): StickyColorId {
  return typeof value === 'string' && STICKY_IDS.includes(value) ? (value as StickyColorId) : DEFAULT_STICKY_COLOR
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

// ───────────── التسلسل ─────────────

export function serializeCanvas(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  viewport: Viewport,
): StoredCanvas {
  return {
    schemaVersion: 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
      ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: edge.data,
    })),
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  }
}

// ───────────── إعادة البناء مع التحقق ─────────────

function sanitizeBase(data: UnknownRecord, now: number): BaseNodeData {
  const tags: string[] = []
  if (Array.isArray(data.tags)) {
    for (const tag of data.tags.slice(0, MAX_TAGS * 2)) {
      if (typeof tag === 'string') {
        const next = addTag(tags, tag)
        tags.splice(0, tags.length, ...next)
      }
    }
  }
  const createdAt = isFiniteNumber(data.createdAt) ? data.createdAt : now
  return { createdAt, updatedAt: isFiniteNumber(data.updatedAt) ? data.updatedAt : createdAt, tags }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function sanitizeSize(raw: UnknownRecord, type: CanvasNode['type']): { width: number; height?: number } {
  const limits = getResizeLimits(type)
  const defaultWidth = type === 'image' ? IMAGE_LIMITS.defaultWidth : NODE_SIZES[type].width
  const width = clamp(isFiniteNumber(raw.width) ? raw.width : defaultWidth, limits.minWidth, limits.maxWidth)
  if (type === 'image') return { width }
  const defaultHeight = NODE_SIZES[type].height
  return {
    width,
    height: clamp(isFiniteNumber(raw.height) ? raw.height : defaultHeight, limits.minHeight, limits.maxHeight),
  }
}

/** يعيد عقدة نظيفة (بدون parentId؛ تُعالج العضوية لاحقاً) أو null إن تعذّر إنقاذها. */
function sanitizeNode(value: unknown, now: number): CanvasNode | null {
  if (!isRecord(value)) return null
  const { id, type } = value
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null
  if (!isRecord(value.position) || !isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.y)) return null
  const position = {
    x: clamp(value.position.x, -MAX_COORDINATE, MAX_COORDINATE),
    y: clamp(value.position.y, -MAX_COORDINATE, MAX_COORDINATE),
  }
  const data = isRecord(value.data) ? value.data : {}
  const base = sanitizeBase(data, now)

  switch (type) {
    case 'sticky':
      return {
        id,
        type: 'sticky',
        position,
        ...sanitizeSize(value, 'sticky'),
        data: {
          ...base,
          title: text(data.title, TITLE_MAX_LENGTH),
          content: text(data.content, CONTENT_MAX_LENGTH),
          color: stickyColor(data.color),
          textColor: typeof data.textColor === 'string' && HEX_COLOR.test(data.textColor) ? data.textColor : null,
        },
      }
    case 'text':
      return {
        id,
        type: 'text',
        position,
        ...sanitizeSize(value, 'text'),
        data: { ...base, title: text(data.title, TITLE_MAX_LENGTH), content: text(data.content, CONTENT_MAX_LENGTH) },
      }
    case 'image': {
      const imageId = typeof data.imageId === 'string' && data.imageId.length > 0 && data.imageId.length <= 128 ? data.imageId : null
      const naturalWidth = data.naturalWidth
      const naturalHeight = data.naturalHeight
      // بلا معرّف صورة أو أبعاد صالحة لا يمكن رسم البطاقة (النسبة مجهولة): نتجاهلها
      if (imageId === null || !isFiniteNumber(naturalWidth) || !isFiniteNumber(naturalHeight) || naturalWidth < 1 || naturalHeight < 1) {
        return null
      }
      return {
        id,
        type: 'image',
        position,
        ...sanitizeSize(value, 'image'),
        data: {
          ...base,
          imageId,
          title: text(data.title, TITLE_MAX_LENGTH),
          description: text(data.description, DESCRIPTION_MAX_LENGTH),
          fileName: text(data.fileName, 255),
          naturalWidth,
          naturalHeight,
        },
      }
    }
    case 'link': {
      const url = typeof data.url === 'string' ? (normalizeUrl(data.url) ?? '') : ''
      return {
        id,
        type: 'link',
        position,
        ...sanitizeSize(value, 'link'),
        data: { ...base, url, title: text(data.title, TITLE_MAX_LENGTH), description: text(data.description, DESCRIPTION_MAX_LENGTH) },
      }
    }
    case 'group':
      return {
        id,
        type: 'group',
        position,
        ...sanitizeSize(value, 'group'),
        dragHandle: '.group-drag-handle',
        data: { ...base, label: text(data.label, GROUP_LABEL_MAX_LENGTH), color: stickyColor(data.color) },
      }
    default:
      return null
  }
}

function sanitizeEdgeData(value: unknown): CanvasEdgeData {
  const data = isRecord(value) ? value : {}
  return {
    curve: oneOf(EDGE_CURVES, data.curve, DEFAULT_EDGE_DATA.curve),
    lineStyle: oneOf(EDGE_LINE_STYLES, data.lineStyle, DEFAULT_EDGE_DATA.lineStyle),
    arrow: oneOf(EDGE_ARROWS, data.arrow, DEFAULT_EDGE_DATA.arrow),
    color: oneOf(EDGE_COLOR_IDS, data.color, DEFAULT_EDGE_DATA.color),
    label: text(data.label, EDGE_LABEL_MAX_LENGTH),
  }
}

export interface DecodedCanvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
  /** عدد العناصر (عقد ووصلات) التي تعذّر استرجاعها لتلفها */
  discardedCount: number
}

export function deserializeCanvas(stored: StoredCanvas, now: number = Date.now()): DecodedCanvas {
  let discardedCount = 0

  // 1) العقد: نظيفة وفريدة المعرّف وضمن الحد الأقصى
  const clean: CanvasNode[] = []
  const seen = new Set<string>()
  const parentOf = new Map<string, unknown>()
  for (const raw of stored.nodes.slice(0, MAX_NODES)) {
    const node = sanitizeNode(raw, now)
    if (node === null || seen.has(node.id)) {
      discardedCount += 1
      continue
    }
    seen.add(node.id)
    if (isRecord(raw) && raw.parentId !== undefined) parentOf.set(node.id, raw.parentId)
    clean.push(node)
  }
  discardedCount += Math.max(0, stored.nodes.length - MAX_NODES)

  // 2) العضوية: الأب يجب أن يكون مجموعة موجودة، والعقدة نفسها ليست مجموعة (لا تداخل)
  const groups = new Map(clean.filter((node): node is GroupContainer => node.type === 'group').map((g) => [g.id, g]))
  const nodes = clean.map((node): CanvasNode => {
    const parentId = parentOf.get(node.id)
    if (node.type !== 'group' && typeof parentId === 'string' && groups.has(parentId)) return { ...node, parentId }
    return node
  })

  // 3) الوصلات: طرفان موجودان وغير مجموعتين ومختلفان، دون تكرار بنفس الاتجاه
  const nodeTypes = new Map(nodes.map((node) => [node.id, node.type]))
  const edges: CanvasEdge[] = []
  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  for (const raw of stored.edges.slice(0, MAX_EDGES)) {
    if (!isRecord(raw)) {
      discardedCount += 1
      continue
    }
    const { id, source, target } = raw
    const valid =
      typeof id === 'string' && id.length > 0 && id.length <= 128 && !edgeIds.has(id) &&
      typeof source === 'string' && typeof target === 'string' && source !== target &&
      nodeTypes.has(source) && nodeTypes.has(target) &&
      nodeTypes.get(source) !== 'group' && nodeTypes.get(target) !== 'group' &&
      !pairs.has(`${source}\u0000${target}`)
    if (!valid) {
      discardedCount += 1
      continue
    }
    edgeIds.add(id)
    pairs.add(`${source}\u0000${target}`)
    edges.push({
      id,
      type: 'connection',
      source,
      target,
      sourceHandle: isHandleSide(typeof raw.sourceHandle === 'string' ? raw.sourceHandle : null) ? (raw.sourceHandle as string) : 'right',
      targetHandle: isHandleSide(typeof raw.targetHandle === 'string' ? raw.targetHandle : null) ? (raw.targetHandle as string) : 'left',
      data: sanitizeEdgeData(raw.data),
    })
  }
  discardedCount += Math.max(0, stored.edges.length - MAX_EDGES)

  const { viewport } = stored
  return {
    nodes: sortGroupsFirst(nodes),
    edges,
    viewport: {
      x: clamp(viewport.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(viewport.y, -MAX_COORDINATE, MAX_COORDINATE),
      zoom: clamp(viewport.zoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max),
    },
    discardedCount,
  }
}

/** المعرّفات المرجعية للصور في لوحة مخزَّنة (للتنظيف): تقرأ بتسامح دون الحاجة لتحقق كامل. */
export function collectImageIds(stored: StoredCanvas): Set<string> {
  const ids = new Set<string>()
  for (const node of stored.nodes) {
    if (isRecord(node) && node.type === 'image' && isRecord(node.data) && typeof node.data.imageId === 'string') {
      ids.add(node.data.imageId)
    }
  }
  return ids
}
