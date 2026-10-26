import type { XYPosition } from '@xyflow/react'
import { createId } from '@/lib/id'
import type { CanvasEdge } from '../types/edges'
import type {
  CanvasNode,
  CreatableNodeKind,
  GroupContainer,
  ImageCard,
  LinkCard,
  StickyColorId,
  StickyNote,
  TextCard,
} from '../types/nodes'
import { DEFAULT_STICKY_COLOR, DUPLICATE_OFFSET, NODE_SIZES } from './constants'
import { sortGroupsFirst } from './group-utils'

/** تحويل مركز العقدة المطلوب إلى موضع الزاوية العليا اليسرى (الذي يستخدمه React Flow). */
function topLeftFromCenter(center: XYPosition, width: number, height: number): XYPosition {
  return { x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2) }
}

export function createStickyNote(
  center: XYPosition,
  now: number,
  color: StickyColorId = DEFAULT_STICKY_COLOR,
): StickyNote {
  const { width, height } = NODE_SIZES.sticky
  return {
    id: createId(),
    type: 'sticky',
    position: topLeftFromCenter(center, width, height),
    width,
    height,
    data: { title: '', content: '', color, textColor: null, tags: [], createdAt: now, updatedAt: now },
  }
}

export function createTextCard(center: XYPosition, now: number): TextCard {
  const { width, height } = NODE_SIZES.text
  return {
    id: createId(),
    type: 'text',
    position: topLeftFromCenter(center, width, height),
    width,
    height,
    data: { title: '', content: '', tags: [], createdAt: now, updatedAt: now },
  }
}

export function createLinkCard(center: XYPosition, now: number): LinkCard {
  const { width, height } = NODE_SIZES.link
  return {
    id: createId(),
    type: 'link',
    position: topLeftFromCenter(center, width, height),
    width,
    height,
    data: { url: '', title: '', description: '', tags: [], createdAt: now, updatedAt: now },
  }
}

export function createGroup(center: XYPosition, now: number): GroupContainer {
  const { width, height } = NODE_SIZES.group
  return {
    id: createId(),
    type: 'group',
    position: topLeftFromCenter(center, width, height),
    width,
    height,
    // لا يُسحب الإطار إلا من شريط العنوان، فيبقى السحب على جسمه الفارغ تحريكاً للوحة (انظر canvas.css)
    dragHandle: '.group-drag-handle',
    data: { label: '', color: 'neutral', tags: [], createdAt: now, updatedAt: now },
  }
}

export interface NewImageInput {
  imageId: string
  fileName: string
  naturalWidth: number
  naturalHeight: number
  /** العرض الابتدائي بوحدات اللوحة؛ الارتفاع يُشتق من نسبة الصورة فلا يُخزَّن */
  width: number
}

/** بطاقة صورة: بلا height مخزّن عمداً (ارتفاعها يتبع النسبة، ويقيسه React Flow). */
export function createImageCard(center: XYPosition, now: number, input: NewImageInput): ImageCard {
  const estimatedHeight = Math.round((input.width * input.naturalHeight) / input.naturalWidth)
  return {
    id: createId(),
    type: 'image',
    position: topLeftFromCenter(center, input.width, estimatedHeight),
    width: input.width,
    data: {
      imageId: input.imageId,
      title: '',
      description: '',
      fileName: input.fileName,
      naturalWidth: input.naturalWidth,
      naturalHeight: input.naturalHeight,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
  }
}

/** ينشئ عقدة من النوع المطلوب مركزها عند النقطة المعطاة (بإحداثيات اللوحة). */
export function createNode(kind: CreatableNodeKind, center: XYPosition, now: number): CanvasNode {
  switch (kind) {
    case 'sticky':
      return createStickyNote(center, now)
    case 'text':
      return createTextCard(center, now)
    case 'link':
      return createLinkCard(center, now)
    case 'group':
      return createGroup(center, now)
  }
}

/** نسخة من العقدة بمعرّف جديد وتواريخ جديدة، دون حالات React Flow المؤقتة (dragging/measured/resizing). */
function cloneNode(node: CanvasNode, now: number, id: string, position: XYPosition, parentId?: string): CanvasNode {
  const base = {
    id,
    position,
    width: node.width,
    height: node.height,
    selected: true,
    ...(parentId ? { parentId } : {}),
  }
  const fresh = { createdAt: now, updatedAt: now }
  switch (node.type) {
    case 'sticky':
      return { ...base, type: 'sticky', data: { ...node.data, tags: [...node.data.tags], ...fresh } }
    case 'text':
      return { ...base, type: 'text', data: { ...node.data, tags: [...node.data.tags], ...fresh } }
    case 'image':
      return { ...base, type: 'image', data: { ...node.data, tags: [...node.data.tags], ...fresh } }
    case 'link':
      return { ...base, type: 'link', data: { ...node.data, tags: [...node.data.tags], ...fresh } }
    case 'group':
      return {
        ...base,
        type: 'group',
        ...(node.dragHandle ? { dragHandle: node.dragHandle } : {}),
        data: { ...node.data, tags: [...node.data.tags], ...fresh },
      }
  }
}

export interface DuplicationResult {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/**
 * ينسخ العقد المحددة مع ما يلزم ليبقى المنسوخ متسقاً:
 *  - نسخ مجموعة ينسخ أعضاءها أيضاً (مجموعة فارغة ليست ما يتوقعه المستخدم)، ومواضعهم النسبية تبقى كما هي.
 *  - عضو نُسخ دون مجموعته يبقى في المجموعة نفسها (مع الإزاحة)؛ أما أعضاء مجموعة منسوخة فيتبعون نسختها.
 *  - الوصلات التي طرفاها كلاهما ضمن المنسوخ تُنسخ أيضاً؛ الوصلة بين منسوخ وغير منسوخ لا تُنسخ (مصدر ارتباك).
 * نبني الكائنات حقلاً حقلاً ونعيد نسخ مصفوفة tags كي لا تُشارَك بالمرجع.
 */
export function duplicateNodes(
  selected: readonly CanvasNode[],
  allNodes: readonly CanvasNode[],
  allEdges: readonly CanvasEdge[],
  now: number,
  offset: number = DUPLICATE_OFFSET,
): DuplicationResult {
  const selectedIds = new Set(selected.map((node) => node.id))
  const selectedGroupIds = new Set(selected.filter((node) => node.type === 'group').map((node) => node.id))

  // ما سيُنسخ: المحدد + أعضاء المجموعات المحددة (دون تكرار)
  const toCopy = [
    ...selected,
    ...allNodes.filter((node) => node.parentId && selectedGroupIds.has(node.parentId) && !selectedIds.has(node.id)),
  ]
  const idMap = new Map(toCopy.map((node) => [node.id, createId()]))

  const copies = toCopy.map((node): CanvasNode => {
    const newId = idMap.get(node.id) ?? createId()
    const parentCopyId = node.parentId ? idMap.get(node.parentId) : undefined
    if (parentCopyId) {
      // عضو تابع لنسخة مجموعته: الموضع النسبي لا يتغير لأن النسخة كلها أُزيحت مع مجموعتها
      return cloneNode(node, now, newId, { ...node.position }, parentCopyId)
    }
    const position = { x: node.position.x + offset, y: node.position.y + offset }
    return cloneNode(node, now, newId, position, node.parentId)
  })

  const edges = allEdges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge): CanvasEdge => ({
      ...edge,
      id: createId(),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: false,
      data: edge.data ? { ...edge.data } : edge.data,
    }))

  return { nodes: sortGroupsFirst(copies), edges }
}
