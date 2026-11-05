import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'

/**
 * واجهة التخزين: كل ما يحتاجه التطبيق من طبقة الحفظ.
 * الدوال غير متزامنة (Promise) عمداً، حتى يمكن استبدال localStorage بـ IndexedDB
 * في المرحلة 4 دون تغيير أي كود يستدعيها.
 */

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

/**
 * لقطة اللوحة المحفوظة. العقد والوصلات عامة (unknown) عمداً على مستوى التخزين: طبقة التخزين لا تعرف
 * أنواع اللوحة، والتحقق الصارم يجري عند القراءة في features/canvas/persistence/canvas-codec.ts.
 */
export interface StoredCanvas {
  schemaVersion: 1
  nodes: unknown[]
  edges: unknown[]
  viewport: CanvasViewport
}

export interface LoadedWorkspaces {
  workspaces: WorkspaceMeta[]
  /** عدد المدخلات التالفة التي تم تجاهلها */
  discardedCount: number
  /** true إذا تعذّر فهم المحتوى المحفوظ بالكامل (تالف أو من إصدار أحدث) */
  unreadable: boolean
  /** مفتاح النسخة الاحتياطية التي حُفظ فيها المحتوى غير المقروء، إن نجح حفظها */
  backupKey: string | null
}

export interface LoadedCanvas {
  /** null: لا توجد لوحة محفوظة لهذه المساحة (جديدة)، أو تعذّر فهم المحفوظ (انظر unreadable) */
  canvas: StoredCanvas | null
  /** true إذا وُجد محتوى مخزَّن لكن تعذّر فهمه (تالف أو من إصدار أحدث) */
  unreadable: boolean
  /** مفتاح النسخة الاحتياطية التي حُفظ فيها المحتوى غير المقروء، إن نجح حفظها */
  backupKey: string | null
}

export type StorageFailureReason = 'quota' | 'unavailable' | 'unknown'

export class StorageError extends Error {
  readonly reason: StorageFailureReason

  constructor(reason: StorageFailureReason, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
    this.reason = reason
  }
}

/** الحد الأدنى الذي نطلبه من أي مخزن مفاتيح/قيم (localStorage أو ذاكرة مؤقتة). */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /**
   * تعداد المفاتيح (اختياري): واجهة Storage في المتصفح توفرهما، وبدونهما لا يمكن عرض النسخ الاحتياطية
   * المحفوظة في localStorage، لكن بقية التطبيق يعمل.
   */
  readonly length?: number
  key?(index: number): string | null
}

/** نوع النسخة الاحتياطية: قائمة المساحات، أو محتوى لوحة مساحة واحدة. */
export type BackupKind = 'workspaces' | 'canvas'

export interface BackupInfo {
  key: string
  kind: BackupKind
  /** معرّف المساحة لنسخ اللوحات؛ null لنسخة القائمة */
  workspaceId: string | null
  /** null إن لم يُسجَّل وقت النسخ (نسخ اللوحات تُكتب بمفتاح ثابت دون تاريخ) */
  createdAt: number | null
  /** حجم تقريبي بالبايت */
  sizeBytes: number
}

export interface StorageAdapter {
  loadWorkspaces(): Promise<LoadedWorkspaces>
  saveWorkspaces(workspaces: readonly WorkspaceMeta[]): Promise<void>
  /** قراءة اللوحة. لا تحذف ولا تكتب فوق محتوى غير مقروء: تنسخه احتياطياً أولاً. */
  loadCanvas(workspaceId: string): Promise<LoadedCanvas>
  saveCanvas(workspaceId: string, canvas: StoredCanvas): Promise<void>
  /** ينسخ بيانات لوحة كما هي (تُستخدم عند تكرار المساحة). لا يفعل شيئاً إن لم تكن هناك بيانات. */
  copyCanvas(fromWorkspaceId: string, toWorkspaceId: string): Promise<void>
  deleteCanvas(workspaceId: string): Promise<void>
  /** يُنبَّه عندما يغيّر تبويب آخر البيانات. يعيد دالة لإلغاء الاشتراك. */
  subscribeToExternalChanges(onChange: () => void): () => void
  /** النسخ الاحتياطية التي حُفظت عند اكتشاف بيانات غير مقروءة (لا تُحذف تلقائياً أبداً). */
  listBackups(): Promise<BackupInfo[]>
  /** المحتوى الخام للنسخة (نص أو كائن مخزَّن)، أو null إن لم تعد موجودة. */
  readBackup(key: string): Promise<unknown>
  deleteBackup(key: string): Promise<void>
}
