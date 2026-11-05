import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import type { CanvasStore } from './indexed-db-canvas-store'
import { isStoredCanvas, toStorageError } from './local-storage-adapter'
import type { BackupInfo, LoadedCanvas, LoadedWorkspaces, StorageAdapter, StoredCanvas } from './storage-adapter'

/**
 * المحوّل الفعلي للتطبيق: بيانات المساحات الصغيرة (الاسم واللون وعدد العناصر والمعاينة) في localStorage
 * لأن قراءتها فورية عند فتح لوحة التحكم، واللوحات الكبيرة (العقد والوصلات والعرض) في IndexedDB.
 * إن لم يتوفر IndexedDB أصلاً (مثلاً متصفح قديم) تذهب اللوحات إلى المحوّل الاحتياطي (localStorage).
 * الأخطاء كلها تُحوَّل إلى StorageError بسبب مفهوم (امتلاء / حجب / غير معروف).
 */
/** بادئة مفاتيح نسخ اللوحات الاحتياطية في IndexedDB (انظر loadCanvas). تميّزها عن نسخ localStorage. */
const IDB_CANVAS_BACKUP_PREFIX = 'canvas-backup:'

export class HybridStorageAdapter implements StorageAdapter {
  constructor(
    private readonly metadata: StorageAdapter,
    /** null = IndexedDB غير متاح: نستعمل المحوّل الاحتياطي للوحات أيضاً */
    private readonly canvases: CanvasStore | null,
  ) {}

  loadWorkspaces(): Promise<LoadedWorkspaces> {
    return this.metadata.loadWorkspaces()
  }

  saveWorkspaces(workspaces: readonly WorkspaceMeta[]): Promise<void> {
    return this.metadata.saveWorkspaces(workspaces)
  }

  subscribeToExternalChanges(onChange: () => void): () => void {
    return this.metadata.subscribeToExternalChanges(onChange)
  }

  async loadCanvas(workspaceId: string): Promise<LoadedCanvas> {
    if (!this.canvases) return this.metadata.loadCanvas(workspaceId)
    let raw: unknown
    try {
      raw = await this.canvases.get(workspaceId)
    } catch (error) {
      throw toStorageError(error)
    }
    if (raw === undefined || raw === null) return { canvas: null, unreadable: false, backupKey: null }
    if (isStoredCanvas(raw)) return { canvas: raw, unreadable: false, backupKey: null }

    // محتوى موجود لكن غير مفهوم (تالف أو إصدار أحدث): نحفظ نسخة منه قبل أن يكتب الحفظ التالي فوقه
    // مفتاح ثابت لكل مساحة: إعادة القراءة (فتح المحرر، أو تنظيف الصور) لا تكدّس نسخاً مكررة
    const backupKey = `canvas-backup:${workspaceId}`
    try {
      await this.canvases.putBackup(backupKey, raw)
      return { canvas: null, unreadable: true, backupKey }
    } catch {
      return { canvas: null, unreadable: true, backupKey: null }
    }
  }

  async saveCanvas(workspaceId: string, canvas: StoredCanvas): Promise<void> {
    if (!this.canvases) return this.metadata.saveCanvas(workspaceId, canvas)
    try {
      await this.canvases.put(workspaceId, canvas)
    } catch (error) {
      throw toStorageError(error)
    }
  }

  async copyCanvas(fromWorkspaceId: string, toWorkspaceId: string): Promise<void> {
    if (!this.canvases) return this.metadata.copyCanvas(fromWorkspaceId, toWorkspaceId)
    try {
      const raw = await this.canvases.get(fromWorkspaceId)
      if (raw === undefined || raw === null) return
      await this.canvases.put(toWorkspaceId, raw)
    } catch (error) {
      throw toStorageError(error)
    }
  }

  async deleteCanvas(workspaceId: string): Promise<void> {
    if (!this.canvases) return this.metadata.deleteCanvas(workspaceId)
    try {
      await this.canvases.delete(workspaceId)
    } catch (error) {
      throw toStorageError(error)
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    const local = await this.metadata.listBackups()
    if (!this.canvases) return local
    try {
      const stored = await this.canvases.listBackups()
      const fromIdb = stored
        .filter((item) => item.key.startsWith(IDB_CANVAS_BACKUP_PREFIX))
        .map((item): BackupInfo => ({
          key: item.key,
          kind: 'canvas',
          workspaceId: item.key.slice(IDB_CANVAS_BACKUP_PREFIX.length),
          createdAt: null,
          sizeBytes: item.sizeBytes,
        }))
      return [...local, ...fromIdb]
    } catch {
      // IndexedDB لا يُقرأ: نعرض نسخ localStorage على الأقل بدل إخفاء الشاشة كلها
      return local
    }
  }

  async readBackup(key: string): Promise<unknown> {
    if (!key.startsWith(IDB_CANVAS_BACKUP_PREFIX)) return this.metadata.readBackup(key)
    if (!this.canvases) return null
    try {
      return (await this.canvases.getBackup(key)) ?? null
    } catch (error) {
      throw toStorageError(error)
    }
  }

  async deleteBackup(key: string): Promise<void> {
    if (!key.startsWith(IDB_CANVAS_BACKUP_PREFIX)) return this.metadata.deleteBackup(key)
    if (!this.canvases) return
    try {
      await this.canvases.deleteBackup(key)
    } catch (error) {
      throw toStorageError(error)
    }
  }
}
