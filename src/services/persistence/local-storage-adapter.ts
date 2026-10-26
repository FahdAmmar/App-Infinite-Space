import {
  DEFAULT_COLOR,
  DEFAULT_ICON,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PREVIEW_MAX_RECTS,
} from '@/features/workspaces/utils/constants'
import { normalizeText } from '@/features/workspaces/utils/validation'
import {
  WORKSPACE_COLOR_IDS,
  WORKSPACE_ICON_IDS,
  type PreviewKind,
  type PreviewRect,
  type WorkspaceColorId,
  type WorkspaceIconId,
  type WorkspaceMeta,
} from '@/features/workspaces/types/workspace'
import {
  StorageError,
  type KeyValueStore,
  type LoadedCanvas,
  type LoadedWorkspaces,
  type StorageAdapter,
  type StoredCanvas,
} from './storage-adapter'

export const WORKSPACES_KEY = 'infinitespace:v1:workspaces'
export const CANVAS_KEY_PREFIX = 'infinitespace:v1:canvas:'
const SCHEMA_VERSION = 1

const canvasKey = (workspaceId: string): string => `${CANVAS_KEY_PREFIX}${workspaceId}`

// ───────────── التحقق من البيانات المقروءة ─────────────
// كل ما نقرأه من localStorage "غير موثوق": قد يكون عدّله المستخدم أو كتبه إصدار قديم/جديد.
// لذلك نعيد بناء كل كائن من الحقول المعروفة فقط بدل الوثوق بالشكل المخزّن.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const COLOR_IDS: ReadonlySet<string> = new Set(WORKSPACE_COLOR_IDS)
const ICON_IDS: ReadonlySet<string> = new Set(WORKSPACE_ICON_IDS)
const PREVIEW_KINDS: ReadonlySet<string> = new Set<PreviewKind>([
  'sticky',
  'text',
  'image',
  'link',
  'group',
])

function isColorId(value: unknown): value is WorkspaceColorId {
  return typeof value === 'string' && COLOR_IDS.has(value)
}

function isIconId(value: unknown): value is WorkspaceIconId {
  return typeof value === 'string' && ICON_IDS.has(value)
}

function isPreviewKind(value: unknown): value is PreviewKind {
  return typeof value === 'string' && PREVIEW_KINDS.has(value)
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

function sanitizePreview(value: unknown): PreviewRect[] {
  if (!Array.isArray(value)) return []
  const rects: PreviewRect[] = []
  for (const item of value.slice(0, PREVIEW_MAX_RECTS)) {
    if (!isRecord(item)) continue
    const { x, y, w, h, kind } = item
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) continue
    if (!isPreviewKind(kind)) continue
    rects.push({ x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h), kind })
  }
  return rects
}

/**
 * يعيد بناء مساحة نظيفة من قيمة مخزّنة، أو null إن لم يكن ممكناً إنقاذها.
 * نُصلح ما يمكن إصلاحه (لون/أيقونة غير معروفة، تاريخ ناقص) بدل حذف مساحة المستخدم.
 */
export function sanitizeWorkspace(value: unknown, fallbackNow: number): WorkspaceMeta | null {
  if (!isRecord(value)) return null

  const { id } = value
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null

  const name =
    typeof value.name === 'string' ? normalizeText(value.name).slice(0, NAME_MAX_LENGTH).trimEnd() : ''
  if (name.length === 0) return null

  const description =
    typeof value.description === 'string'
      ? normalizeText(value.description).slice(0, DESCRIPTION_MAX_LENGTH).trimEnd()
      : ''

  const updatedAt = isFiniteNumber(value.updatedAt)
    ? value.updatedAt
    : isFiniteNumber(value.createdAt)
      ? value.createdAt
      : fallbackNow
  const createdAt = isFiniteNumber(value.createdAt) ? value.createdAt : updatedAt

  return {
    id,
    name,
    description,
    color: isColorId(value.color) ? value.color : DEFAULT_COLOR,
    icon: isIconId(value.icon) ? value.icon : DEFAULT_ICON,
    createdAt,
    updatedAt,
    lastOpenedAt: isFiniteNumber(value.lastOpenedAt) ? value.lastOpenedAt : null,
    nodeCount: isFiniteNumber(value.nodeCount) && value.nodeCount >= 0 ? Math.floor(value.nodeCount) : 0,
    preview: sanitizePreview(value.preview),
  }
}

export interface ParsedWorkspaces {
  workspaces: WorkspaceMeta[]
  discardedCount: number
}

/** يحلل النص المخزّن. يعيد null إذا لم يكن بالشكل/الإصدار المعروف (انظر loadWorkspaces). */
export function parseWorkspacesPayload(raw: string, fallbackNow: number): ParsedWorkspaces | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.workspaces)) {
    return null
  }

  const seen = new Set<string>()
  const workspaces: WorkspaceMeta[] = []
  let discardedCount = 0

  for (const entry of parsed.workspaces) {
    const workspace = sanitizeWorkspace(entry, fallbackNow)
    // مدخل تالف أو معرّف مكرر: نتجاهله لأن تكرار المعرّف يكسر الاختيار والحذف
    if (workspace === null || seen.has(workspace.id)) {
      discardedCount += 1
      continue
    }
    seen.add(workspace.id)
    workspaces.push(workspace)
  }
  return { workspaces, discardedCount }
}

export function isStoredCanvas(value: unknown): value is StoredCanvas {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false
  const { viewport } = value
  return (
    isRecord(viewport) &&
    isFiniteNumber(viewport.x) &&
    isFiniteNumber(viewport.y) &&
    isFiniteNumber(viewport.zoom)
  )
}

/** يحوّل أي خطأ تخزين إلى StorageError بسبب مفهوم (امتلاء، حجب، أو غير معروف). */
export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  if (error instanceof DOMException) {
    const isQuota =
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox
      error.code === 22 ||
      error.code === 1014
    if (isQuota) return new StorageError('quota', 'Browser storage is full.', { cause: error })
    if (error.name === 'SecurityError') {
      return new StorageError('unavailable', 'Browser storage is blocked.', { cause: error })
    }
  }
  return new StorageError('unknown', 'Browser storage failed.', { cause: error })
}

// ───────────── المحوّل ─────────────

export class LocalStorageAdapter implements StorageAdapter {
  private readonly store: KeyValueStore

  constructor(store: KeyValueStore) {
    this.store = store
  }

  private read(key: string): string | null {
    try {
      return this.store.getItem(key)
    } catch (error) {
      throw toStorageError(error)
    }
  }

  private write(key: string, value: string): void {
    try {
      this.store.setItem(key, value)
    } catch (error) {
      throw toStorageError(error)
    }
  }

  async loadWorkspaces(): Promise<LoadedWorkspaces> {
    const raw = this.read(WORKSPACES_KEY)
    if (raw === null) {
      return { workspaces: [], discardedCount: 0, unreadable: false, backupKey: null }
    }

    const parsed = parseWorkspacesPayload(raw, Date.now())
    if (parsed !== null) return { ...parsed, unreadable: false, backupKey: null }

    // المحتوى تالف أو من إصدار أحدث: أول حفظ قادم سيكتب فوقه، لذا نحتفظ بنسخة منه أولاً
    // حتى لا يخسر المستخدم بياناته بصمت.
    const backupKey = `${WORKSPACES_KEY}:backup-${Date.now()}`
    try {
      this.store.setItem(backupKey, raw)
      return { workspaces: [], discardedCount: 0, unreadable: true, backupKey }
    } catch {
      return { workspaces: [], discardedCount: 0, unreadable: true, backupKey: null }
    }
  }

  async saveWorkspaces(workspaces: readonly WorkspaceMeta[]): Promise<void> {
    this.write(WORKSPACES_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, workspaces }))
  }

  async loadCanvas(workspaceId: string): Promise<LoadedCanvas> {
    const key = canvasKey(workspaceId)
    const raw = this.read(key)
    if (raw === null) return { canvas: null, unreadable: false, backupKey: null }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isStoredCanvas(parsed)) return { canvas: parsed, unreadable: false, backupKey: null }
    } catch {
      /* تالف: ننسخه احتياطياً أدناه */
    }
    // لا نتجاهله بصمت: أول حفظ قادم سيكتب فوقه، فنحتفظ بنسخة منه
    const backupKey = `${key}:backup` // ثابت: لا نكدّس نسخاً عند تكرار القراءة
    try {
      this.store.setItem(backupKey, raw)
      return { canvas: null, unreadable: true, backupKey }
    } catch {
      return { canvas: null, unreadable: true, backupKey: null }
    }
  }

  async saveCanvas(workspaceId: string, canvas: StoredCanvas): Promise<void> {
    this.write(canvasKey(workspaceId), JSON.stringify(canvas))
  }

  async copyCanvas(fromWorkspaceId: string, toWorkspaceId: string): Promise<void> {
    const raw = this.read(canvasKey(fromWorkspaceId))
    if (raw === null) return
    this.write(canvasKey(toWorkspaceId), raw)
  }

  async deleteCanvas(workspaceId: string): Promise<void> {
    try {
      this.store.removeItem(canvasKey(workspaceId))
    } catch (error) {
      throw toStorageError(error)
    }
  }

  subscribeToExternalChanges(onChange: () => void): () => void {
    // حدث "storage" يصل فقط للتبويبات الأخرى (وليس التبويب الذي كتب)، وهو المطلوب هنا
    const handler = (event: StorageEvent): void => {
      if (event.key === null || event.key === WORKSPACES_KEY) onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
}
