import type { Viewport } from '@xyflow/react'
import { deserializeCanvas, serializeCanvas, type DecodedCanvas } from '@/features/canvas/persistence/canvas-codec'
import type { CanvasEdge } from '@/features/canvas/types/edges'
import type { CanvasNode } from '@/features/canvas/types/nodes'
import { IMAGE_LIMITS } from '@/features/canvas/utils/constants'
import type { WorkspaceInput } from '@/features/workspaces/types/workspace'
import { DEFAULT_COLOR, DEFAULT_ICON } from '@/features/workspaces/utils/constants'
import { base64DecodedLength, isBase64 } from '@/lib/base64'
import { sanitizeWorkspace } from '@/services/persistence/local-storage-adapter'
import type { StoredCanvas } from '@/services/persistence/storage-adapter'

/**
 * صيغة ملف تصدير المساحة (JSON واحد، الصور بترميز Base64).
 * اخترنا JSON لا ZIP كي لا نضيف تبعية لضغط الملفات: الصور مضغوطة أصلاً فلا فائدة من ضغط إضافي،
 * وثمن ذلك زيادة نحو 33% في حجم الصور داخل الملف.
 * الملف «غير موثوق» عند الاستيراد (قد يكتبه أي أحد): كل حقل يمر عبر نفس المعقّمات التي تحمي بيانات التخزين.
 */

export const PACKAGE_FORMAT = 'infinitespace-workspace'
/** 2 = بطاقات تحمل status/locked وأنواعاً أحدث. نقرأ الإصدار 1 كما هو، ونكتب 2 فترفضه النسخ الأقدم بدل أن تُسقط الحقول الجديدة بصمت. */
export const PACKAGE_VERSION = 2
export const PACKAGE_FILE_SUFFIX = '.infinitespace.json'
/** الحد نفسه عند التصدير والاستيراد: أي ملف نصدّره نقبل استيراده. */
export const PACKAGE_MAX_BYTES = 256 * 1024 * 1024
export const FALLBACK_WORKSPACE_NAME = 'Imported workspace'

export interface PackagedImage {
  type: string
  data: string
}

export interface WorkspacePackage {
  format: typeof PACKAGE_FORMAT
  version: typeof PACKAGE_VERSION
  exportedAt: number
  workspace: WorkspaceInput
  canvas: StoredCanvas
  images: Record<string, PackagedImage>
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ACCEPTED_IMAGE_TYPES: readonly string[] = IMAGE_LIMITS.acceptedTypes

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(type)
}

export function buildPackage(input: {
  workspace: WorkspaceInput
  nodes: readonly CanvasNode[]
  edges: readonly CanvasEdge[]
  viewport: Viewport
  images: Record<string, PackagedImage>
  exportedAt: number
}): WorkspacePackage {
  return {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    exportedAt: input.exportedAt,
    workspace: input.workspace,
    canvas: serializeCanvas(input.nodes, input.edges, input.viewport),
    images: input.images,
  }
}

export interface ParsedPackage {
  workspace: WorkspaceInput
  canvas: DecodedCanvas
  /** الصور المرجعية في اللوحة فقط وصالحة الشكل؛ بيانات زائدة في الملف تُهمل */
  images: Map<string, PackagedImage>
  /** صور مذكورة في الملف لكنها غير صالحة (نوع غير مسموح، ترميز تالف، حجم زائد) */
  invalidImages: number
}

export type ParseResult = { ok: true; value: ParsedPackage } | { ok: false; message: string }

const fail = (message: string): ParseResult => ({ ok: false, message })
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const

function readWorkspace(value: unknown, now: number): WorkspaceInput {
  const cleaned = sanitizeWorkspace({ ...(isRecord(value) ? value : {}), id: 'imported' }, now)
  return {
    name: cleaned?.name ?? FALLBACK_WORKSPACE_NAME,
    description: cleaned?.description ?? '',
    color: cleaned?.color ?? DEFAULT_COLOR,
    icon: cleaned?.icon ?? DEFAULT_ICON,
  }
}

function readViewport(value: unknown): StoredCanvas['viewport'] {
  if (!isRecord(value)) return { ...DEFAULT_VIEWPORT }
  const { x, y, zoom } = value
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  return finite(x) && finite(y) && finite(zoom) ? { x, y, zoom } : { ...DEFAULT_VIEWPORT }
}

function referencedImageIds(decoded: DecodedCanvas): Set<string> {
  const ids = new Set<string>()
  for (const node of decoded.nodes) if (node.type === 'image') ids.add(node.data.imageId)
  return ids
}

function readImages(value: unknown, wanted: ReadonlySet<string>): { images: Map<string, PackagedImage>; invalid: number } {
  const images = new Map<string, PackagedImage>()
  let invalid = 0
  if (!isRecord(value)) return { images, invalid }
  // Map لا كائن: مفتاح مثل "__proto__" يصبح مفتاحاً عادياً ولا يمسّ النموذج الأولي
  for (const [id, entry] of Object.entries(value)) {
    if (!wanted.has(id)) continue
    const valid =
      isRecord(entry) &&
      typeof entry.type === 'string' &&
      isAcceptedImageType(entry.type) &&
      typeof entry.data === 'string' &&
      entry.data.length > 0 &&
      isBase64(entry.data) &&
      base64DecodedLength(entry.data) <= IMAGE_LIMITS.maxBytes
    if (valid) images.set(id, { type: entry.type as string, data: entry.data as string })
    else invalid += 1
  }
  return { images, invalid }
}

export function parsePackage(text: string, now: number = Date.now()): ParseResult {
  if (text.length > PACKAGE_MAX_BYTES) return fail('This file is too large to import.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail("This file isn't valid JSON, so it can't be a workspace export.")
  }
  if (!isRecord(parsed) || parsed.format !== PACKAGE_FORMAT) {
    return fail("This isn't an InfiniteSpace workspace file.")
  }
  const { version } = parsed
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('This workspace file has an invalid version number.')
  }
  if (version > PACKAGE_VERSION) {
    return fail('This file was created by a newer version of InfiniteSpace. Update the app and try again.')
  }

  const rawCanvas = parsed.canvas
  if (!isRecord(rawCanvas) || !Array.isArray(rawCanvas.nodes)) {
    return fail('This workspace file has no canvas content.')
  }
  const canvas = deserializeCanvas(
    {
      schemaVersion: 1,
      nodes: rawCanvas.nodes,
      edges: Array.isArray(rawCanvas.edges) ? rawCanvas.edges : [],
      viewport: readViewport(rawCanvas.viewport),
    },
    now,
  )

  const { images, invalid } = readImages(parsed.images, referencedImageIds(canvas))
  return { ok: true, value: { workspace: readWorkspace(parsed.workspace, now), canvas, images, invalidImages: invalid } }
}

// ───────────── اسم الملف ─────────────

// محارف ممنوعة في أسماء الملفات على ويندوز (وتحكم)، وتُستبدل بمسافة
// eslint-disable-next-line no-control-regex -- النطاق مقصود: إزالة محارف التحكم من اسم الملف
const FILE_NAME_FORBIDDEN = /[\\/:*?"<>|\u0000-\u001F]/g

/** اسم ملف آمن على كل الأنظمة: يحافظ على الحروف العربية واللاتينية ويضيف تاريخ التصدير. */
export function makeExportFileName(workspaceName: string, date: Date): string {
  const base = workspaceName
    .replace(FILE_NAME_FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') // ملف يبدأ بنقطة يصبح مخفياً
    .slice(0, 60)
    .trim()
  return `${base || 'workspace'}-${date.toISOString().slice(0, 10)}${PACKAGE_FILE_SUFFIX}`
}
